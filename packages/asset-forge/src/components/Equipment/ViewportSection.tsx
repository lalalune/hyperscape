import { Package, Grid3X3, Camera, Activity, RotateCw, Play, Pause } from 'lucide-react'
import React from 'react'

import type { HandleDetectionResult } from '../../services/processing/WeaponHandleDetector'
import { Asset } from '../../types'
import { hasAnimations } from '../../types/AssetMetadata'
import { Card, CardContent, Button, EmptyState } from '../common'

import EquipmentViewer, { EquipmentViewerRef } from './EquipmentViewer'


interface ViewportSectionProps {
  selectedAvatar: Asset | null
  selectedEquipment: Asset | null
  equipmentSlot: string
  showSkeleton: boolean
  setShowSkeleton: (show: boolean) => void
  viewerRef: React.RefObject<EquipmentViewerRef | null>
  handleDetectionResult: HandleDetectionResult | null
  avatarHeight: number
  autoScaleWeapon: boolean
  weaponScaleOverride: number
  manualRotation: { x: number; y: number; z: number }
  manualPosition: { x: number; y: number; z: number }
  currentAnimation: 'tpose' | 'walking' | 'running'
  setCurrentAnimation: (animation: 'tpose' | 'walking' | 'running') => void
  isAnimationPlaying: boolean
  setIsAnimationPlaying: (playing: boolean) => void
}

export const ViewportSection: React.FC<ViewportSectionProps> = ({
  selectedAvatar,
  selectedEquipment,
  equipmentSlot,
  showSkeleton,
  setShowSkeleton,
  viewerRef,
  handleDetectionResult,
  avatarHeight,
  autoScaleWeapon,
  weaponScaleOverride,
  manualRotation,
  manualPosition,
  currentAnimation,
  setCurrentAnimation,
  isAnimationPlaying,
  setIsAnimationPlaying
}) => {
  const getAvatarUrl = () => {
    if (!selectedAvatar) return undefined
    const animations = hasAnimations(selectedAvatar) ? selectedAvatar.metadata.animations?.basic : undefined
    
    // Use animation files when available
    let url = `/api/assets/${selectedAvatar.id}/model`  // Default to base model
    
    if (currentAnimation === 'walking' && animations?.walking) {
      url = `/api/assets/${selectedAvatar.id}/${animations.walking}`
    } else if (currentAnimation === 'running' && animations?.running) {
      url = `/api/assets/${selectedAvatar.id}/${animations.running}`
    } else if (currentAnimation === 'tpose' && animations?.tpose) {
      url = `/api/assets/${selectedAvatar.id}/${animations.tpose}`
    }
    
    console.log(`🎮 Avatar URL for animation '${currentAnimation}':`, url)
    
    return url
  }
  
  return (
    <div className="flex-1 flex flex-col">
      <div className="overflow-hidden flex-1 relative bg-gradient-to-br from-bg-primary to-bg-secondary rounded-xl">
        {selectedAvatar || selectedEquipment ? (
          <>
            <EquipmentViewer
              ref={viewerRef}
              avatarUrl={getAvatarUrl()}
              equipmentUrl={selectedEquipment && selectedEquipment.hasModel ? `/api/assets/${selectedEquipment.id}/model` : undefined}
              equipmentSlot={equipmentSlot}
              showSkeleton={showSkeleton}
              weaponType={selectedEquipment?.metadata?.subtype || selectedEquipment?.type || 'sword'}
              avatarHeight={avatarHeight}
              autoScale={autoScaleWeapon}
              scaleOverride={weaponScaleOverride}
              gripOffset={handleDetectionResult ? {
                x: handleDetectionResult.gripPoint.x,
                y: handleDetectionResult.gripPoint.y,
                z: handleDetectionResult.gripPoint.z
              } : undefined}
              orientationOffset={manualRotation}
              positionOffset={manualPosition}
              isAnimating={isAnimationPlaying && currentAnimation !== 'tpose'}
              animationType={currentAnimation}
            />
            
            {/* Viewport Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                size="sm"
                variant={showSkeleton ? 'primary' : 'secondary'}
                onClick={() => setShowSkeleton(!showSkeleton)}
                title="Toggle skeleton"
                className="backdrop-blur-sm"
                aria-label="Toggle skeleton visibility"
              >
                <Grid3X3 size={18} />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => viewerRef.current?.resetCamera?.()}
                title="Reset camera"
                className="backdrop-blur-sm"
                aria-label="Reset camera position"
              >
                <Camera size={18} />
              </Button>
            </div>
            
            {/* Animation Controls */}
            {selectedAvatar && hasAnimations(selectedAvatar) && selectedAvatar.metadata.animations?.basic && (
              <Card className="absolute bottom-4 left-4 right-4 bg-bg-tertiary/80 backdrop-blur-md border border-white/10">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                        <Activity className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">Animation Controls</p>
                        <p className="text-xs text-text-tertiary">Test equipment with animations</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={currentAnimation === 'tpose' ? 'primary' : 'secondary'}
                        onClick={() => {
                          setCurrentAnimation('tpose')
                          setIsAnimationPlaying(false)
                        }}
                        className="gap-2"
                      >
                        <RotateCw className="w-4 h-4" />
                        T-Pose
                      </Button>
                      
                      <Button
                        size="sm"
                        variant={currentAnimation === 'walking' && isAnimationPlaying ? 'primary' : 'secondary'}
                        onClick={() => {
                          if (currentAnimation === 'walking' && isAnimationPlaying) {
                            setIsAnimationPlaying(false)
                          } else {
                            setCurrentAnimation('walking')
                            setIsAnimationPlaying(true)
                          }
                        }}
                        className="gap-2"
                      >
                        {currentAnimation === 'walking' && isAnimationPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Walking
                      </Button>
                      
                      <Button
                        size="sm"
                        variant={currentAnimation === 'running' && isAnimationPlaying ? 'primary' : 'secondary'}
                        onClick={() => {
                          if (currentAnimation === 'running' && isAnimationPlaying) {
                            setIsAnimationPlaying(false)
                          } else {
                            setCurrentAnimation('running')
                            setIsAnimationPlaying(true)
                          }
                        }}
                        className="gap-2"
                      >
                        {currentAnimation === 'running' && isAnimationPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Running
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={Package}
              title="No Preview Available"
              description="Select an avatar and equipment to begin"
              iconSize={80}
              className="animate-fade-in"
            />
          </div>
        )}
      </div>
    </div>
  )
} 