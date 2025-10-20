import { Play, Pause, RotateCcw, Activity, Loader2, Eye, FileText, X, Download } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { Button, Modal } from '../common'

import ThreeViewer, { ThreeViewerRef } from './ThreeViewer'

interface AnimationPlayerProps {
  modelUrl: string  // Not used anymore, kept for compatibility
  animations?: {
    basic?: {
      walking?: string
      running?: string
      tpose?: string
    }
  }
  className?: string
  riggedModelPath?: string  // Not used anymore, kept for compatibility
  characterHeight?: number  // Expected character height in meters
  assetId?: string  // Optional asset ID if not extractable from modelUrl
}

export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({ 
  modelUrl, 
  animations,
  className,
  characterHeight,
  assetId: assetIdProp
}) => {
  const viewerRef = React.useRef<ThreeViewerRef>(null)
  const [currentAnimation, setCurrentAnimation] = useState<'resting' | 'tpose' | 'walking' | 'running'>(
    animations?.basic?.tpose ? 'tpose' : 'resting'
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [_animationsLoaded, _setAnimationsLoaded] = useState(false)
  const [showingSkeleton, setShowingSkeleton] = useState(false)
  const [primaryModelUrl, setPrimaryModelUrl] = useState<string>('')
  const [showBonesModal, setShowBonesModal] = useState(false)
  const [bonesData, setBonesData] = useState<{ name: string, parent: string }[]>([])
  
  // Debug component lifecycle
  useEffect(() => {
    console.log('🎮 AnimationPlayer mounted')
    return () => {
      console.log('🎮 AnimationPlayer unmounted')
    }
  }, [])
  
  // Extract asset ID from the model URL or use provided assetId
  const extractedAssetId = modelUrl?.match(new RegExp('^/api/assets/([^/]+)/model'))?.[1] || ''
  const assetId = assetIdProp || extractedAssetId || ''
  
  // No need to fetch metadata separately, it's passed as a prop
  useEffect(() => {
    if (characterHeight) {
      console.log(`Character height: ${characterHeight}m`)
    }
  }, [characterHeight])
  
  // Determine which model file to use as the primary model
  // Prefer the extracted T-pose, then walking animation
  useEffect(() => {
    console.log('🎮 AnimationPlayer: Determining primary model URL')
    console.log('   assetId:', assetId)
    console.log('   animations:', animations)
    
    if (animations?.basic?.tpose && assetId) {
      // Use the extracted T-pose model (no animations, proper scale)
      const url = `/api/assets/${assetId}/${animations.basic.tpose}`
      console.log('   Using T-pose model:', url)
      setPrimaryModelUrl(url)
    } else if (animations?.basic?.walking && assetId) {
      // Fallback to walking animation file
      const url = `/api/assets/${assetId}/${animations.basic.walking}`
      console.log('   Using walking model:', url)
      setPrimaryModelUrl(url)
    } else if (animations?.basic?.running && assetId) {
      // Last resort: running animation
      const url = `/api/assets/${assetId}/${animations.basic.running}`
      console.log('   Using running model:', url)
      setPrimaryModelUrl(url)
    } else {
      console.log('   No suitable model found')
    }
  }, [animations, assetId])
  
  const availableAnimations = React.useMemo(() => {
    const anims = []
    
    // Always add T-pose as the first option
    if (animations?.basic?.tpose) {
      anims.push({ 
        id: 'tpose', 
        name: 'T-Pose', 
        url: `/api/assets/${assetId}/${animations.basic.tpose}` 
      })
    } else {
      // Fallback to resting pose if no T-pose file
      anims.push({ 
        id: 'resting', 
        name: 'T-Pose', 
        url: null  // No separate file, uses the model without animation
      })
    }
    
    // Check for walking animation
    if (animations?.basic?.walking) {
      anims.push({ 
        id: 'walking', 
        name: 'Walking', 
        url: `/api/assets/${assetId}/${animations.basic.walking}` 
      })
    }
    
    // Check for running animation
    if (animations?.basic?.running) {
      anims.push({ 
        id: 'running', 
        name: 'Running', 
        url: `/api/assets/${assetId}/${animations.basic.running}` 
      })
    }
    
    return anims
  }, [animations, assetId])
  
  // Track when models are loaded
  useEffect(() => {
    if (!primaryModelUrl) return
    
    // All models are self-contained, no need to load animations separately
    _setAnimationsLoaded(true)
    setIsLoading(false)
  }, [primaryModelUrl])
  
  // Cleanup on unmount
  useEffect(() => {
    const viewerAtMount = viewerRef.current
    return () => {
      if (viewerAtMount) {
        viewerAtMount.stopAnimation()
      }
    }
  }, [])

  const handlePlayAnimation = async (animId: 'resting' | 'tpose' | 'walking' | 'running') => {
    if (!viewerRef.current) return
    
    // Special handling for resting state (fallback when no T-pose file)
    if (animId === 'resting') {
      // Stop all animations to show bind pose
      viewerRef.current.stopAnimation()
      setCurrentAnimation('resting')
      setIsPlaying(false)
      return
    }
    
    // For any animation, switch the model URL to load the correct GLB file
    if (animations?.basic && assetId) {
      let newModelUrl = ''
      
      switch (animId) {
        case 'tpose':
          if (animations.basic.tpose) {
            newModelUrl = `/api/assets/${assetId}/${animations.basic.tpose}`
          }
          break
        case 'walking':
          if (animations.basic.walking) {
            newModelUrl = `/api/assets/${assetId}/${animations.basic.walking}`
          }
          break
        case 'running':
          if (animations.basic.running) {
            newModelUrl = `/api/assets/${assetId}/${animations.basic.running}`
          }
          break
      }
      
      if (newModelUrl && newModelUrl !== primaryModelUrl) {
        // Switch to the new model
        setPrimaryModelUrl(newModelUrl)
        setCurrentAnimation(animId)
        setIsPlaying(animId !== 'tpose') // T-pose is static, others are animated
        console.log(`Switching to model: ${newModelUrl} for animation: ${animId}`)
      } else if (newModelUrl === primaryModelUrl) {
        // Same model, just toggle play/pause
        if (animId !== 'tpose' && isPlaying) {
          viewerRef.current?.pauseAnimation()
          setIsPlaying(false)
        } else if (animId !== 'tpose' && !isPlaying) {
          viewerRef.current?.resumeAnimation()
          setIsPlaying(true)
        }
      }
      
      return
    }
  }

  const _handleReset = () => {
    const defaultState = animations?.basic?.tpose ? 'tpose' : 'resting'
    setCurrentAnimation(defaultState)
    setIsPlaying(false)
    if (viewerRef.current) {
      viewerRef.current.stopAnimation()
      viewerRef.current.resetCamera()
    }
  }
  
  const handleToggleSkeleton = () => {
    if (viewerRef.current) {
      viewerRef.current.toggleSkeleton()
      setShowingSkeleton(!showingSkeleton)
    }
  }
  
  const handleExportTPose = () => {
    if (viewerRef.current) {
      viewerRef.current.exportTPoseModel()
    }
  }
  
  const handleLogBones = () => {
    if (viewerRef.current) {
      const data = viewerRef.current.logBoneStructure()
      if (data) {
        setBonesData(data.bones)
        setShowBonesModal(true)
      } else {
        console.log("No bone structure found in the model")
      }
    }
  }
  


  if (!primaryModelUrl) {
    return (
      <div className={`relative ${className} flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-secondary`}>
        <div className="text-center p-8">
          <Activity className="w-12 h-12 text-text-muted mb-4 mx-auto" />
          <p className="text-text-tertiary">No animations available for this asset</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <ThreeViewer
        ref={viewerRef}
        modelUrl={primaryModelUrl}
        assetInfo={{
          name: assetId || 'character',  // Use asset ID for export filename
          requiresAnimationStrip: !primaryModelUrl.includes('t-pose.glb'),  // Don't strip if already T-pose
          isAnimationFile: !primaryModelUrl.includes('t-pose.glb'),         // T-pose files aren't animation files
          characterHeight: characterHeight // Pass character height to ThreeViewer
        }}
        isAnimationPlayer={true}
      />
      
      {/* Top Left Controls - Additional animation-specific buttons */}
      <div className="absolute top-4 left-4 flex gap-2 z-10">
        <div className="flex bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-lg shadow-lg p-1 border border-border-primary gap-1">
          <button
            onClick={handleToggleSkeleton}
            className={`p-2 rounded transition-all duration-200 ${
              showingSkeleton 
                ? 'bg-primary bg-opacity-20 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
            title="Toggle skeleton visualization"
          >
            <Eye size={18} />
          </button>
          
          <button
            onClick={handleLogBones}
            className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
            title="View bone structure"
          >
            <FileText size={18} />
          </button>
          
          <button
            onClick={handleExportTPose}
            className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
            title="Export T-pose model"
          >
            <Download size={18} />
          </button>
        </div>
      </div>
      
      {/* Animation Controls Overlay */}
      <div className="absolute bottom-4 left-4 right-4 bg-bg-primary bg-opacity-90 backdrop-blur-sm rounded-lg p-3 border border-border-primary z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-text-primary">Animations</span>
            {isLoading && (
              <Loader2 className="w-3 h-3 text-text-secondary animate-spin" />
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {availableAnimations.map(anim => (
              <Button
                key={anim.id}
                size="sm"
                variant={
                  currentAnimation === anim.id && (anim.id === 'resting' || anim.id === 'tpose' || isPlaying) 
                    ? 'primary' 
                    : 'secondary'
                }
                onClick={() => handlePlayAnimation(anim.id as 'resting' | 'tpose' | 'walking' | 'running')}
                className="text-xs"
                disabled={false} // All animations are available since we switch models
              >
                {(anim.id === 'resting' || anim.id === 'tpose') ? (
                  <RotateCcw className="w-3 h-3" />
                ) : currentAnimation === anim.id && isPlaying ? (
                  <Pause className="w-3 h-3" />
                ) : (
                  <Play className="w-3 h-3" />
                )}
                <span className="ml-1">{anim.name}</span>
              </Button>
            ))}
            

            

          </div>
        </div>
      </div>
      
      {/* Bones Structure Modal */}
      <Modal
        open={showBonesModal}
        onClose={() => setShowBonesModal(false)}
        size="lg"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-text-primary">Bone Structure</h2>
            <button
              onClick={() => setShowBonesModal(false)}
              className="p-1 hover:bg-bg-primary rounded transition-colors"
            >
              <X size={20} className="text-text-muted" />
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <div className="text-sm text-text-secondary mb-2">
              Total bones: {bonesData.length}
            </div>
            
            {bonesData.length > 0 ? (
              <div className="font-mono text-xs space-y-1">
                {bonesData.map((bone, index) => (
                  <div key={index} className="flex gap-2 p-2 bg-bg-secondary rounded">
                    <span className="text-text-muted min-w-[3rem]">[{index}]</span>
                    <span className="text-text-primary flex-1">{bone.name}</span>
                    <span className="text-text-tertiary">→ {bone.parent}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-text-tertiary text-center py-8">
                No bones found in the model
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
} 