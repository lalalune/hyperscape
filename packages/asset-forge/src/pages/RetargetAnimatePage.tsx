import React, { useEffect, useRef, useState } from 'react'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import * as THREE from 'three'
import ThreeViewer, { type ThreeViewerRef } from '../components/shared/ThreeViewer'
import { useRetargetingStore, useCanRetarget } from '../store'
import { AssetService } from '../services/api/AssetService'
import { useAssets } from '@/hooks'

export const RetargetAnimatePage: React.FC = () => {
  const viewerRef = useRef<ThreeViewerRef | null>(null)
  const { assets, loading: assetsLoading } = useAssets()

  // Local workflow state
  const [skeletonLoaded, setSkeletonLoaded] = useState(false)
  const [retargetingApplied, setRetargetingApplied] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [availableAnimations, setAvailableAnimations] = useState<{ name: string, duration: number }[]>([])
  const [selectedAnimation, setSelectedAnimation] = useState<string>('')
  const [loadingState, setLoadingState] = useState<string>('')

  // Zustand state
  const {
    sourceModelUrl,
    sourceModelAssetId,
    targetRigUrl,
    boneEditingEnabled,
    showSkeleton,
    mirrorEnabled,
    transformMode,
    transformSpace,
    setSourceModel,
    setTargetRig,
    setBoneEditingEnabled,
    setShowSkeleton,
    setMirrorEnabled,
    setTransformMode,
    setTransformSpace,
    reset
  } = useRetargetingStore()

  const canRetarget = useCanRetarget()

  // Filter assets for character models
  const avatarAssets = assets.filter((a) => a.type === 'character' && (a as any).hasModel)

  // Step 1: Select Models (source + target rig)
  const handleLoadSkeleton = async () => {
    if (!targetRigUrl) {
      alert('Please select a target rig first')
      return
    }

    try {
      setLoadingState('Loading skeleton...')
      console.log('[RetargetAnimatePage] Loading skeleton for editing...')

      // Load the target rig into the viewer
      await viewerRef.current?.setTargetRigFromURL(targetRigUrl)

      // Call the mesh2motion skeleton loading method
      const success = await viewerRef.current?.loadSkeletonForEditing()

      if (success) {
        console.log('[RetargetAnimatePage] Skeleton loaded successfully')
        setSkeletonLoaded(true)
        setShowSkeleton(true) // Auto-show skeleton
        setBoneEditingEnabled(true) // Auto-enable bone editing
        setLoadingState('')
      } else {
        setLoadingState('')
        alert('Failed to load skeleton for editing')
      }
    } catch (error) {
      setLoadingState('')
      console.error('[RetargetAnimatePage] Error loading skeleton:', error)
      alert('Error loading skeleton: ' + (error as Error).message)
    }
  }

  // Step 2: Apply Retargeting (after bone editing)
  const handleApplyRetargeting = async () => {
    try {
      setLoadingState('Applying retargeting and calculating skin weights...')
      console.log('[RetargetAnimatePage] Applying retargeting...')

      // Disable bone editing first
      setBoneEditingEnabled(false)

      // Call the mesh2motion retargeting method
      const success = await viewerRef.current?.applyRetargeting()

      if (success) {
        console.log('[RetargetAnimatePage] Retargeting applied successfully')
        setRetargetingApplied(true)
        setLoadingState('Loading animations...')

        // Fetch available animations from the viewer
        setTimeout(() => {
          const anims = viewerRef.current?.getAvailableAnimations?.() || []
          console.log('[RetargetAnimatePage] Fetched animations:', anims.length)
          setAvailableAnimations(anims.map(a => ({ name: a.name, duration: a.duration })))
          setLoadingState('')
        }, 500) // Small delay to ensure animations are loaded
      } else {
        setLoadingState('')
        alert('Failed to apply retargeting')
      }
    } catch (error) {
      setLoadingState('')
      console.error('[RetargetAnimatePage] Error applying retargeting:', error)
      alert('Error applying retargeting: ' + (error as Error).message)
    }
  }

  // Animation controls
  const handlePlay = (animName: string) => {
    viewerRef.current?.playAnimation(animName)
    setSelectedAnimation(animName)
    setIsPlaying(true)
  }

  const handlePause = () => {
    viewerRef.current?.pauseAnimation()
    setIsPlaying(false)
  }

  const handleResume = () => {
    viewerRef.current?.resumeAnimation()
    setIsPlaying(true)
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      if (viewerRef.current?.exportTPoseModel) {
        viewerRef.current.exportTPoseModel()
      } else {
        // Fallback export
        const exporter = new GLTFExporter()
        const tmpScene = new THREE.Scene()
        await new Promise<void>((resolve, reject) => {
          exporter.parse(tmpScene, (result) => {
            const blob = new Blob([result as ArrayBuffer], { type: 'application/octet-stream' })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = 'retargeted-model.glb'
            a.click()
            resolve()
          }, (err) => reject(err), { binary: true, onlyVisible: false, embedImages: true })
        })
      }
    } finally {
      setExporting(false)
    }
  }

  // Sync bone editing state to viewer
  useEffect(() => {
    if (viewerRef.current?.enableBoneEditing) {
      viewerRef.current.enableBoneEditing(boneEditingEnabled)
    }
  }, [boneEditingEnabled])

  // Sync skeleton visibility - handled by toggleSkeleton() manually
  // No automatic sync needed for showSkeleton

  // Sync transform controls
  useEffect(() => {
    if (viewerRef.current?.setBoneTransformMode) {
      viewerRef.current.setBoneTransformMode(transformMode)
    }
  }, [transformMode])

  useEffect(() => {
    if (viewerRef.current?.setBoneTransformSpace) {
      viewerRef.current.setBoneTransformSpace(transformSpace)
    }
  }, [transformSpace])

  useEffect(() => {
    if (viewerRef.current?.setBoneMirrorEnabled) {
      viewerRef.current.setBoneMirrorEnabled(mirrorEnabled)
    }
  }, [mirrorEnabled])

  return (
    <div className="h-[calc(100vh-60px)] w-full flex">
      {/* Sidebar */}
      <aside className="w-80 border-r border-border-primary bg-bg-secondary p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Mesh2Motion Retargeting</h2>
          <p className="text-xs text-text-tertiary mb-4">
            Load model → Load skeleton → Edit bones → Apply retargeting → Test animations
          </p>
          {loadingState && (
            <div className="px-3 py-2 bg-primary/10 border border-primary/30 rounded-md">
              <p className="text-xs text-primary animate-pulse">{loadingState}</p>
            </div>
          )}
        </div>

        {/* Step 1: Select Models */}
        <section className="space-y-3 p-3 border border-border-primary rounded-md">
          <h3 className="text-sm font-semibold">1. Select Models</h3>

          <div className="space-y-2">
            <label className="text-xs text-text-tertiary">Source Model (Your Character with Mesh)</label>

            {/* File upload option */}
            <div className="space-y-1">
              <input
                type="file"
                accept=".glb,.gltf"
                className="w-full text-xs"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const url = URL.createObjectURL(file)
                    setSourceModel(url, file.name)
                    console.log('[RetargetAnimatePage] Loaded source model from file:', file.name)
                  }
                }}
              />
              <p className="text-xs text-text-tertiary">Upload a GLB/GLTF file with mesh data</p>
            </div>

            {/* Or select from existing assets */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-primary"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-bg-secondary text-text-tertiary">or select from assets</span>
              </div>
            </div>

            <select
              className="w-full px-2 py-1 rounded-md bg-bg-tertiary text-sm"
              disabled={assetsLoading}
              value={sourceModelAssetId || ''}
              onChange={async (e) => {
                const assetId = e.target.value
                const asset = avatarAssets.find(a => a.id === assetId)
                if (asset) {
                  // Use T-pose URL if available
                  const modelUrl = await AssetService.getTPoseUrl(asset.id)
                  setSourceModel(modelUrl, asset.id)
                }
              }}
            >
              <option value="">{assetsLoading ? 'Loading...' : 'Select from assets...'}</option>
              {avatarAssets.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-text-tertiary">Target Rig</label>
            <select
              className="w-full px-2 py-1 rounded-md bg-bg-tertiary text-sm"
              value={targetRigUrl || ''}
              onChange={(e) => {
                const url = e.target.value
                if (url === '/rigs/rig-human.glb') {
                  setTargetRig('mixamo-human', url, 'human')
                } else if (url === '/rigs/rig-fox.glb') {
                  setTargetRig('mixamo-quadruped', url, 'quadruped')
                } else if (url === '/rigs/rig-bird.glb') {
                  setTargetRig('mixamo-bird', url, 'bird')
                }
              }}
            >
              <option value="">Select target rig...</option>
              <option value="/rigs/rig-human.glb">Human Rig</option>
              <option value="/rigs/rig-fox.glb">Quadruped (Fox) Rig</option>
              <option value="/rigs/rig-bird.glb">Bird Rig</option>
            </select>
          </div>

          <button
            className="w-full px-3 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
            disabled={!canRetarget || skeletonLoaded}
            onClick={handleLoadSkeleton}
          >
            {skeletonLoaded ? '✓ Skeleton Loaded' : 'Load Skeleton for Editing'}
          </button>

          {!canRetarget && (
            <p className="text-xs text-amber-400">Select both source model and target rig</p>
          )}
        </section>

        {/* Step 2: Adjust Bone Positions */}
        {skeletonLoaded && !retargetingApplied && (
          <section className="space-y-3 p-3 border border-border-primary rounded-md">
            <h3 className="text-sm font-semibold">2. Adjust Bone Positions</h3>

            <div className="flex items-center justify-between">
              <span className="text-xs">Show Skeleton</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={showSkeleton}
                  onChange={(e) => setShowSkeleton(e.target.checked)}
                />
                <div className="w-9 h-5 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs">Enable Bone Editing</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={boneEditingEnabled}
                  onChange={(e) => setBoneEditingEnabled(e.target.checked)}
                />
                <div className="w-9 h-5 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Transform Mode</label>
              <div className="flex gap-2">
                <button
                  className={`flex-1 px-3 py-1 rounded-md text-sm ${transformMode === 'translate' ? 'bg-primary/20 text-primary' : 'bg-bg-tertiary hover:bg-bg-primary/20'}`}
                  onClick={() => setTransformMode('translate')}
                >
                  Move
                </button>
                <button
                  className={`flex-1 px-3 py-1 rounded-md text-sm ${transformMode === 'rotate' ? 'bg-primary/20 text-primary' : 'bg-bg-tertiary hover:bg-bg-primary/20'}`}
                  onClick={() => setTransformMode('rotate')}
                >
                  Rotate
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Transform Space</label>
              <div className="flex gap-2">
                <button
                  className={`flex-1 px-3 py-1 rounded-md text-sm ${transformSpace === 'world' ? 'bg-primary/20 text-primary' : 'bg-bg-tertiary hover:bg-bg-primary/20'}`}
                  onClick={() => setTransformSpace('world')}
                >
                  World
                </button>
                <button
                  className={`flex-1 px-3 py-1 rounded-md text-sm ${transformSpace === 'local' ? 'bg-primary/20 text-primary' : 'bg-bg-tertiary hover:bg-bg-primary/20'}`}
                  onClick={() => setTransformSpace('local')}
                >
                  Local
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs">Mirror X-Axis</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={mirrorEnabled}
                  onChange={(e) => setMirrorEnabled(e.target.checked)}
                />
                <div className="w-9 h-5 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="pt-2 border-t border-border-primary">
              <p className="text-xs text-text-tertiary mb-2">Instructions:</p>
              <ol className="text-xs text-text-tertiary space-y-1 list-decimal pl-4">
                <li>Enable bone editing above</li>
                <li>Click on a bone joint (sphere) to select it</li>
                <li>Drag the transform gizmo to adjust position/rotation</li>
                <li>Fine-tune shoulders, hips, hands as needed</li>
                <li>Click "Apply Retargeting" when satisfied</li>
              </ol>
            </div>

            <button
              className="w-full px-3 py-2 rounded-md bg-green-600/10 text-green-400 hover:bg-green-600/20 border border-green-600/20"
              onClick={handleApplyRetargeting}
            >
              Apply Retargeting
            </button>
          </section>
        )}

        {/* Step 3: Test Animations */}
        {retargetingApplied && (
          <section className="space-y-3 p-3 border border-border-primary rounded-md">
            <h3 className="text-sm font-semibold">3. Test Animations</h3>

            {availableAnimations.length === 0 ? (
              <p className="text-xs text-text-tertiary">Loading animations...</p>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-text-tertiary">
                    Select Animation ({availableAnimations.length} available)
                  </label>
                  <select
                    className="w-full px-2 py-1 rounded-md bg-bg-tertiary text-sm"
                    value={selectedAnimation}
                    onChange={(e) => handlePlay(e.target.value)}
                  >
                    <option value="">Choose an animation...</option>
                    {availableAnimations.map((anim) => (
                      <option key={anim.name} value={anim.name}>
                        {anim.name} ({anim.duration.toFixed(2)}s)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick access to common animations */}
                <div>
                  <label className="text-xs text-text-tertiary mb-1 block">Quick Select</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay('Idle_Loop')}
                    >
                      Idle
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay('Walk_Loop')}
                    >
                      Walk
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay('Jog_Fwd_Loop')}
                    >
                      Jog
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay('Sprint_Loop')}
                    >
                      Sprint
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay('Jump_Start')}
                    >
                      Jump
                    </button>
                    <button
                      className="px-2 py-1 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handlePlay('Dance_Loop')}
                    >
                      Dance
                    </button>
                  </div>
                </div>

                {/* Playback controls */}
                <div className="flex gap-2 pt-2 border-t border-border-primary">
                  {!isPlaying && (
                    <button
                      className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20"
                      onClick={handleResume}
                    >
                      Resume
                    </button>
                  )}
                  {isPlaying && (
                    <button
                      className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20"
                      onClick={handlePause}
                    >
                      Pause
                    </button>
                  )}
                  <button
                    className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20"
                    onClick={() => viewerRef.current?.stopAnimation()}
                  >
                    Stop
                  </button>
                </div>

                {selectedAnimation && (
                  <p className="text-xs text-green-400">
                    Playing: {selectedAnimation}
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-text-tertiary">
              Test animations to ensure retargeting looks correct. Use the dropdown to access all {availableAnimations.length} animations.
            </p>
          </section>
        )}

        {/* Step 4: Export */}
        {retargetingApplied && (
          <section className="space-y-3 p-3 border border-border-primary rounded-md">
            <h3 className="text-sm font-semibold">4. Export</h3>

            <button
              className="w-full px-3 py-2 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
              disabled={exporting}
              onClick={handleExport}
            >
              {exporting ? 'Exporting...' : 'Export Retargeted Model'}
            </button>

            <p className="text-xs text-text-tertiary">
              Export the retargeted model as a GLB file with the new skeleton.
            </p>
          </section>
        )}

        {/* Utilities */}
        <section className="space-y-2 pt-4 border-t border-border-primary">
          <button
            className="w-full px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20 text-sm"
            onClick={() => viewerRef.current?.resetCamera()}
          >
            Reset Camera
          </button>
          <button
            className="w-full px-3 py-1 rounded-md bg-warning/10 text-warning hover:bg-warning/20 text-sm"
            onClick={() => {
              if (confirm('Reset all settings and start over?')) {
                reset()
                setSkeletonLoaded(false)
                setRetargetingApplied(false)
              }
            }}
          >
            Reset Workflow
          </button>
        </section>
      </aside>

      {/* Viewer */}
      <section className="flex-1">
        <ThreeViewer ref={viewerRef} modelUrl={sourceModelUrl || undefined} isAnimationPlayer={false} />
      </section>
    </div>
  )
}

export default RetargetAnimatePage
