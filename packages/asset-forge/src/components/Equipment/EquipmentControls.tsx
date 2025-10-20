import { 
  Sliders, Target, RotateCw, Move, RefreshCw, 
  Eye, Download, Save, Play, Pause,
  CheckCircle
} from 'lucide-react'
import React from 'react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '../common'

interface Vector3 {
  x: number
  y: number
  z: number
}

interface EquipmentControlsProps {
  // Scale controls
  scale: number
  autoScale: boolean
  onScaleChange: (scale: number) => void
  onAutoScaleChange: (enabled: boolean) => void
  
  // Position controls
  position: Vector3
  onPositionChange: (position: Vector3) => void
  
  // Rotation controls
  rotation: Vector3
  onRotationChange: (rotation: Vector3) => void
  
  // Skeleton controls
  showSkeleton: boolean
  onShowSkeletonChange: (show: boolean) => void
  
  // Animation controls
  isAnimating: boolean
  animationType: 'tpose' | 'walking' | 'running'
  onAnimationToggle: () => void
  onAnimationTypeChange: (type: 'tpose' | 'walking' | 'running') => void
  
  // Actions
  onDetectGripPoint?: () => void
  onReset: () => void
  onExportEquipped?: () => void
  onExportAligned?: () => void
  onSaveConfiguration?: () => void
  
  // Status
  gripPointDetected?: boolean
  isDetecting?: boolean
  autoScaleMessage?: string
}

const RangeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return (
    <div className="relative">
      <input
        type="range"
        className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
        {...props}
      />
    </div>
  )
}

export const EquipmentControls: React.FC<EquipmentControlsProps> = ({
  scale,
  autoScale,
  onScaleChange,
  onAutoScaleChange,
  position,
  onPositionChange,
  rotation,
  onRotationChange,
  showSkeleton,
  onShowSkeletonChange,
  isAnimating,
  animationType,
  onAnimationToggle,
  onAnimationTypeChange,
  onDetectGripPoint,
  onReset,
  onExportEquipped,
  onExportAligned,
  onSaveConfiguration,
  gripPointDetected,
  isDetecting,
  autoScaleMessage
}) => {
  return (
    <div className="space-y-4">
      {/* Scale Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            Scale & Fit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Auto Scale</label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScale}
                  onChange={(e) => onAutoScaleChange(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
            {autoScaleMessage && (
              <div className="text-xs text-text-secondary bg-bg-tertiary rounded p-2">
                {autoScaleMessage}
              </div>
            )}
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Manual Scale</label>
                <span className="text-xs text-text-secondary">{scale.toFixed(2)}x</span>
              </div>
              <RangeInput
                min="0.1"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => onScaleChange(parseFloat(e.target.value))}
                disabled={autoScale}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Position Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Move className="w-4 h-4" />
            Position Offset
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <div key={axis}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium uppercase">{axis}</label>
                  <span className="text-xs text-text-secondary">
                    {position[axis].toFixed(3)}m
                  </span>
                </div>
                <RangeInput
                  min="-0.5"
                  max="0.5"
                  step="0.01"
                  value={position[axis]}
                  onChange={(e) => onPositionChange({
                    ...position,
                    [axis]: parseFloat(e.target.value)
                  })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rotation Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCw className="w-4 h-4" />
            Rotation Offset
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(['x', 'y', 'z'] as const).map((axis) => (
              <div key={axis}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium uppercase">{axis}</label>
                  <span className="text-xs text-text-secondary">
                    {rotation[axis].toFixed(0)}°
                  </span>
                </div>
                <RangeInput
                  min="-180"
                  max="180"
                  step="5"
                  value={rotation[axis]}
                  onChange={(e) => onRotationChange({
                    ...rotation,
                    [axis]: parseFloat(e.target.value)
                  })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Animation Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            Animation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              onClick={onAnimationToggle}
              variant={isAnimating ? "secondary" : "primary"}
              className="w-full"
            >
              {isAnimating ? 'Stop Animation' : 'Play Animation'}
            </Button>
            
            <div className="grid grid-cols-3 gap-2">
              {(['tpose', 'walking', 'running'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => onAnimationTypeChange(type)}
                  className={`px-3 py-2 text-xs rounded-md transition-colors ${
                    animationType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {type === 'tpose' ? 'T-Pose' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {onDetectGripPoint && (
              <Button
                onClick={onDetectGripPoint}
                disabled={isDetecting}
                variant="secondary"
                className="w-full justify-start"
              >
                {isDetecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4 mr-2" />
                    Detect Grip Point
                    {gripPointDetected && (
                      <CheckCircle className="w-3 h-3 ml-auto text-success" />
                    )}
                  </>
                )}
              </Button>
            )}
            
            <Button
              onClick={() => onShowSkeletonChange(!showSkeleton)}
              variant="secondary"
              className="w-full justify-start"
            >
              <Eye className="w-4 h-4 mr-2" />
              {showSkeleton ? 'Hide' : 'Show'} Skeleton
            </Button>
            
            <Button
              onClick={onReset}
              variant="secondary"
              className="w-full justify-start"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset All
            </Button>
            
            {onSaveConfiguration && (
              <Button
                onClick={onSaveConfiguration}
                variant="secondary"
                className="w-full justify-start"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </Button>
            )}
            
            {onExportAligned && (
              <Button
                onClick={onExportAligned}
                variant="secondary"
                className="w-full justify-start"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Aligned Model
              </Button>
            )}
            
            {onExportEquipped && (
              <Button
                onClick={onExportEquipped}
                variant="primary"
                className="w-full justify-start"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Equipped Avatar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 