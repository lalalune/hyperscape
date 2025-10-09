import React from 'react'
import { cn } from '../../styles'
import { RotateCw, RefreshCw } from 'lucide-react'
import { RangeInput } from '../common'

interface OrientationControlsProps {
  manualRotation: { x: number; y: number; z: number }
  onRotationChange: (rotation: { x: number; y: number; z: number }) => void
  selectedEquipment: { hasModel: boolean } | null
}

export const OrientationControls: React.FC<OrientationControlsProps> = ({
  manualRotation,
  onRotationChange,
  selectedEquipment
}) => {
  if (!selectedEquipment?.hasModel) return null
  
  return (
    <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <RotateCw className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Fine-tune Orientation</h3>
            <p className="text-xs text-text-secondary mt-0.5">Manually adjust weapon rotation</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {[
          { axis: 'x', label: 'Forward/Back tilt', color: 'text-red-400' },
          { axis: 'y', label: 'Left/Right turn', color: 'text-green-400' },
          { axis: 'z', label: 'Roll/Twist', color: 'text-blue-400' }
        ].map(({ axis, label, color }) => (
          <div key={axis} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className={cn("w-8 h-8 rounded-md bg-bg-tertiary/50 flex items-center justify-center font-bold text-sm", color)}>
                  {axis.toUpperCase()}
                </div>
                <span className="text-sm text-text-primary">{label}</span>
              </div>
              <span className="text-xs font-mono text-text-primary bg-bg-tertiary/30 px-2 py-1 rounded">
                {manualRotation[axis as keyof typeof manualRotation]}°
              </span>
            </div>
            <RangeInput
              type="range"
              min="-180"
              max="180"
              value={manualRotation[axis as keyof typeof manualRotation]}
              onChange={(e) => onRotationChange({ 
                ...manualRotation, 
                [axis]: Number(e.target.value) 
              })}
            />
          </div>
        ))}
        
        <button
          onClick={() => onRotationChange({ x: 0, y: 0, z: 0 })}
          className="w-full mt-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 bg-bg-secondary/30 text-text-secondary hover:bg-bg-secondary/50 hover:text-text-primary"
        >
          <RefreshCw size={14} />
          <span>Reset Orientation</span>
        </button>
      </div>
    </div>
  )
} 