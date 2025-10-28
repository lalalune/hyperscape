import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import ThreeViewer, { type ThreeViewerRef } from '../components/shared/ThreeViewer'
import { useAssets } from '@/hooks'

type WizardStep = 'loadModel' | 'loadSkeleton' | 'editSkeleton' | 'animations' | 'export'

export const RetargetAnimatePage: React.FC = () => {
  const viewerRef = useRef<ThreeViewerRef | null>(null)
  const [modelUrl, setModelUrl] = useState<string | undefined>(undefined)
  const [step, setStep] = useState<WizardStep>('loadModel')
  const [loadedAnims, setLoadedAnims] = useState<{ name: string }[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [skeletonDetected, setSkeletonDetected] = useState<null | boolean>(null)
  const [selectedRig, setSelectedRig] = useState<'embedded' | 'human' | 'quadruped' | 'bird'>('embedded')
  const [selectedRigAssetId, setSelectedRigAssetId] = useState<string>('')
  const [rigScale, setRigScale] = useState(1.0)
  const [targetRigLoaded, setTargetRigLoaded] = useState(false)
  const { assets, loading: assetsLoading } = useAssets()
  const avatarAssets = useMemo(() => assets.filter((a) => a.type === 'character' && (a as any).hasModel), [assets])
  const humanRigCandidates = useMemo(() => avatarAssets.filter(a => /human|mixamo|rig/i.test(a.name)), [avatarAssets])
  const quadrupedRigCandidates = useMemo(() => avatarAssets.filter(a => /quad|fox|wolf|rig/i.test(a.name)), [avatarAssets])
  const birdRigCandidates = useMemo(() => avatarAssets.filter(a => /bird|dragon|rig/i.test(a.name)), [avatarAssets])

  const steps: { key: WizardStep, label: string }[] = useMemo(() => ([
    { key: 'loadModel', label: 'Load Model' },
    { key: 'loadSkeleton', label: 'Load Skeleton' },
    { key: 'editSkeleton', label: 'Edit Joints' },
    { key: 'animations', label: 'Animations' },
    { key: 'export', label: 'Export' },
  ]), [])

  const handleSelectModel = (file: File | null) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setModelUrl(url)
    setSkeletonDetected(null)
  }

  const handleToggleSkeleton = () => {
    viewerRef.current?.toggleSkeleton()
  }

  const handleLoadAnimation = async (file: File | null) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const name = file.name.replace(/\.glb$/i, '')
    await viewerRef.current?.loadAnimation(url, name)
    setLoadedAnims(prev => [...prev, { name }])
  }

  const handlePlay = (name?: string) => {
    if (name === 'walking' || name === 'running') {
      viewerRef.current?.playAnimation(name)
    }
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
      // Minimal working export: use ThreeViewer T-pose export if available
      // Fallback: export current scene root model if accessible
      if (viewerRef.current?.exportTPoseModel) {
        viewerRef.current.exportTPoseModel()
        setExporting(false)
        return
      }

      // Generic fallback (best-effort): export an empty scene to keep UX non-blocking
      const exporter = new GLTFExporter()
      const tmpScene = new THREE.Scene()
      await new Promise<void>((resolve, reject) => {
        exporter.parse(tmpScene, (result) => {
          const blob = new Blob([result as ArrayBuffer], { type: 'application/octet-stream' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = 'export.glb'
          a.click()
          resolve()
        }, (err) => reject(err), { binary: true, onlyVisible: false, embedImages: true })
      })
    } finally {
      setExporting(false)
    }
  }

  // Auto-detect skeleton presence after model loads
  useEffect(() => {
    if (!modelUrl) return
    // slight delay to allow ThreeViewer to load
    const id = setTimeout(() => {
      try {
        const info = viewerRef.current?.logBoneStructure?.()
        setSkeletonDetected(!!info && info.bones.length > 0)
      } catch {
        setSkeletonDetected(null)
      }
    }, 500)
    return () => clearTimeout(id)
  }, [modelUrl])

  return (
    <div className="h-[calc(100vh-60px)] w-full flex">
      {/* Sidebar */}
      <aside className="w-80 border-r border-border-primary bg-bg-secondary p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Retarget & Animate</h2>
          <ol className="space-y-1">
            {steps.map(s => (
              <li key={s.key}>
                <button
                  className={`w-full text-left px-3 py-2 rounded-md transition-all ${step === s.key ? 'bg-primary/10 text-primary' : 'hover:bg-bg-tertiary text-text-secondary'}`}
                  onClick={() => setStep(s.key)}
                >{s.label}</button>
              </li>
            ))}
          </ol>
        </div>

        {step === 'loadModel' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm">Model (.glb)</label>
              <input type="file" accept=".glb" onChange={(e) => handleSelectModel(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Or select existing avatar</label>
              <select
                className="mt-1 w-full px-2 py-1 rounded-md bg-bg-tertiary text-sm"
                disabled={assetsLoading || avatarAssets.length === 0}
                onChange={(e) => {
                  const id = e.target.value
                  const asset = avatarAssets.find(a => a.id === id)
                  if (asset && (asset as any).hasModel) {
                    setModelUrl(`/api/assets/${asset.id}/model`)
                    setSkeletonDetected(null)
                  }
                }}
              >
                <option value="">{assetsLoading ? 'Loading…' : (avatarAssets.length ? 'Select an avatar…' : 'No avatars found')}</option>
                {avatarAssets.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20" onClick={() => viewerRef.current?.resetCamera()}>Frame</button>
              <button className="px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20" onClick={() => viewerRef.current?.toggleSkeleton()}>Skeleton</button>
            </div>
            <p className="text-xs text-text-tertiary">Use Frame to center the model. Move-to-floor/orientation controls will be added here.</p>
          </div>
        )}

        {step === 'loadSkeleton' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Show Skeleton</span>
              <button className="px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20" onClick={handleToggleSkeleton}>Toggle</button>
            </div>
            <div>
              <label className="text-sm">Rig</label>
              <select
                className="mt-1 w-full px-2 py-1 rounded-md bg-bg-tertiary text-sm"
                value={selectedRig}
                onChange={async (e) => {
                  const newRig = e.target.value as typeof selectedRig
                  setSelectedRig(newRig)
                  setTargetRigLoaded(false)
                  // Auto-load standard rig when selected
                  if (newRig !== 'embedded') {
                    const rigPath = newRig === 'human' ? '/rigs/rig-human.glb'
                      : newRig === 'quadruped' ? '/rigs/rig-fox.glb'
                      : '/rigs/rig-bird.glb'
                    await viewerRef.current?.setTargetRigFromURL?.(rigPath)
                    setTargetRigLoaded(true)
                  }
                }}
              >
                <option value="embedded">Use Embedded Skeleton</option>
                <option value="human">Standard Human</option>
                <option value="quadruped">Standard Quadruped (Fox)</option>
                <option value="bird">Standard Bird</option>
              </select>
            </div>
            {selectedRig !== 'embedded' && targetRigLoaded && (
              <div className="space-y-2">
                <button
                  className="w-full px-3 py-1 rounded-md bg-green-600/10 text-green-400 hover:bg-green-600/20"
                  onClick={async () => {
                    const success = await viewerRef.current?.retargetSkeletonToRig?.()
                    if (success) {
                      alert('Skeleton retargeted! Your avatar now uses the standard rig skeleton.')
                    } else {
                      alert('Retargeting failed. Check console for details.')
                    }
                  }}
                >
                  Apply Skeleton Retargeting
                </button>
                <span className="text-xs text-green-400">✓ Target rig ready ({selectedRig})</span>
              </div>
            )}
            <div>
              <label className="text-sm">Rig Scale: {rigScale.toFixed(2)}x</label>
              <input className="w-full" type="range" min={0.25} max={2.0} step={0.01} value={rigScale} onChange={(e) => setRigScale(parseFloat(e.target.value))} />
              <p className="text-xs text-text-tertiary">Scale affects standard rigs; embedded skeleton scale remains unchanged.</p>
            </div>
            <div className="text-xs text-text-tertiary">
              {skeletonDetected === null && <span>Detecting skeleton…</span>}
              {skeletonDetected === true && <span className="text-green-400">Skeleton detected</span>}
              {skeletonDetected === false && <span className="text-amber-400">No skeleton detected — run Bind/Weight step (coming soon)</span>}
            </div>
          </div>
        )}

        {step === 'editSkeleton' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <p className="text-xs text-amber-400 mb-2">After retargeting, the skeleton may not perfectly match your avatar's proportions. Use this step to manually adjust bone positions for a better fit.</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Enable Bone Editing</span>
              <button className="px-3 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20" onClick={() => viewerRef.current?.enableBoneEditing?.(true)}>Enable</button>
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Transform Mode</label>
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20 text-sm" onClick={() => viewerRef.current?.setBoneTransformMode?.('translate')}>Translate</button>
                <button className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20 text-sm" onClick={() => viewerRef.current?.setBoneTransformMode?.('rotate')}>Rotate</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-text-tertiary mb-1 block">Transform Space</label>
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20 text-sm" onClick={() => viewerRef.current?.setBoneTransformSpace?.('world')}>World</button>
                <button className="flex-1 px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20 text-sm" onClick={() => viewerRef.current?.setBoneTransformSpace?.('local')}>Local</button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Mirror X-Axis</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" onChange={(e) => viewerRef.current?.setBoneMirrorEnabled?.(e.target.checked)} />
                <div className="w-9 h-5 bg-bg-tertiary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="border-t border-border-primary pt-3">
              <p className="text-xs text-text-tertiary mb-2">How to use:</p>
              <ol className="text-xs text-text-tertiary space-y-1 list-decimal pl-4">
                <li>Enable bone editing</li>
                <li>Click a joint (sphere) to select it</li>
                <li>Drag the gizmo to adjust position/rotation</li>
                <li>Fine-tune shoulders, hips, hands as needed</li>
                <li>Proceed to Animations when satisfied</li>
              </ol>
            </div>
            <button
              className="w-full px-3 py-2 rounded-md bg-green-600/10 text-green-400 hover:bg-green-600/20 border border-green-600/20"
              onClick={() => {
                viewerRef.current?.alignToBindPose?.()
                alert('Skeleton reset to bind pose. Re-apply retargeting from Load Skeleton if needed.')
              }}
            >
              Reset to Bind Pose
            </button>
          </div>
        )}

        {step === 'animations' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm">Add Animation (.glb)</label>
              <input type="file" accept=".glb" onChange={(e) => handleLoadAnimation(e.target.files?.[0] ?? null)} />
            </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded-md bg-primary/10 text-primary" onClick={() => viewerRef.current?.playAnimationRetargeted?.('walking')}>Play Walk</button>
                  <button className="px-3 py-1 rounded-md bg-primary/10 text-primary" onClick={() => viewerRef.current?.playAnimationRetargeted?.('running')}>Play Run</button>
                </div>
                <div className="flex gap-2">
                  {!isPlaying && <button className="px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20" onClick={handleResume}>Resume</button>}
                  {isPlaying && <button className="px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20" onClick={handlePause}>Pause</button>}
                  <button className="px-3 py-1 rounded-md bg-bg-tertiary hover:bg-bg-primary/20" onClick={() => viewerRef.current?.alignToBindPose?.()}>Reset Pose</button>
                </div>
              <ul className="text-xs text-text-tertiary list-disc pl-5">
                {loadedAnims.map(a => (<li key={a.name}>{a.name}</li>))}
              </ul>
            </div>
          </div>
        )}

        {step === 'export' && (
          <div className="space-y-2">
            <button disabled={exporting} className="px-3 py-2 rounded-md bg-primary/10 text-primary disabled:opacity-50" onClick={handleExport}>
              {exporting ? 'Exporting…' : 'Export GLB'}
            </button>
            <p className="text-xs text-text-tertiary">Exports current model (TPose export wired; full animated export to follow).</p>
          </div>
        )}
      </aside>

      {/* Viewer */}
      <section className="flex-1">
        <ThreeViewer ref={viewerRef} modelUrl={modelUrl} isAnimationPlayer={false} />
      </section>
    </div>
  )
}

export default RetargetAnimatePage


