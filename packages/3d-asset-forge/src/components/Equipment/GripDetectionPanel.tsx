import React from 'react'
import { cn } from '../../styles'
import { Sparkles, Wand2, Loader2, CheckCircle, RefreshCw, Check } from 'lucide-react'
import type { HandleDetectionResult } from '../../services/processing/WeaponHandleDetector'

interface GripDetectionPanelProps {
  selectedEquipment: { hasModel: boolean } | null
  isDetectingHandle: boolean
  handleDetectionResult: HandleDetectionResult | null
  onDetectGripPoint: () => void
}

export const GripDetectionPanel: React.FC<GripDetectionPanelProps> = ({
  selectedEquipment,
  isDetectingHandle,
  handleDetectionResult,
  onDetectGripPoint
}) => {
  if (!selectedEquipment?.hasModel) return null
  
  return (
    <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg animate-pulse">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">AI Grip Detection</h3>
            <p className="text-xs text-text-secondary mt-0.5">Automatically detect weapon grip point</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        <button
          onClick={onDetectGripPoint}
          disabled={isDetectingHandle}
          className={cn(
            "w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2",
            "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg hover:shadow-xl",
            "hover:scale-[1.02] active:scale-[0.98]",
            isDetectingHandle && "opacity-70 cursor-not-allowed"
          )}
        >
          {isDetectingHandle ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Analyzing weapon...</span>
            </>
          ) : (
            <>
              <Wand2 size={16} />
              <span>Verify Weapon Normalization</span>
            </>
          )}
        </button>
        
        {handleDetectionResult && (
          <div className="mt-4 space-y-3 animate-fade-in">
            <div className="flex items-center gap-2.5 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle size={18} className="text-green-500" />
              <span className="text-sm font-medium text-green-500">Handle detected successfully</span>
            </div>
            
            <div className="space-y-3 p-3 bg-bg-secondary/40 rounded-lg border border-white/10">
              <div className="flex justify-between text-xs">
                <span className="text-text-tertiary">Confidence</span>
                <span className="text-text-primary font-medium">
                  {Math.round((handleDetectionResult.confidence || 0) * 100)}%
                </span>
              </div>
              
              {handleDetectionResult.orientationFlipped && (
                <div className="flex items-center gap-2 text-xs text-blue-400">
                  <RefreshCw size={12} />
                  Auto-flipped to correct orientation
                </div>
              )}
              
              <div className="text-xs space-y-1">
                <span className="text-text-tertiary">Grip coordinates:</span>
                <div className="font-mono text-text-primary">
                  ({handleDetectionResult.gripPoint.x.toFixed(3)}, {handleDetectionResult.gripPoint.y.toFixed(3)}, {handleDetectionResult.gripPoint.z.toFixed(3)})
                </div>
              </div>
              
              {Math.abs(handleDetectionResult.gripPoint.x) < 0.01 && 
               Math.abs(handleDetectionResult.gripPoint.y) < 0.01 && 
               Math.abs(handleDetectionResult.gripPoint.z) < 0.01 && (
                <div className="flex items-center gap-2 text-xs text-green-400">
                  <Check size={12} />
                  Weapon properly normalized
                </div>
              )}
            </div>
            
            {handleDetectionResult.annotatedImage && (
              <div className="space-y-2">
                <img 
                  src={handleDetectionResult.annotatedImage} 
                  alt="Detected grip area"
                  className="w-full rounded-lg border border-white/10"
                />
                <p className="text-xs text-text-tertiary text-center">
                  Red box indicates detected grip area
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 