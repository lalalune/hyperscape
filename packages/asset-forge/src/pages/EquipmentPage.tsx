import React, { useState, useRef, useEffect } from 'react'
import { useAssets } from '../hooks/useAssets'
import { Asset } from '../types'
import { EquipmentViewerRef } from '../components/Equipment/EquipmentViewer'
import { WeaponHandleDetector } from '../services/processing/WeaponHandleDetector'
import type { HandleDetectionResult } from '../services/processing/WeaponHandleDetector'
import { notify } from '../utils/notify'

// Import all modular components
import {
  AssetSelectionPanel,
  ViewportSection,
  EquipmentSlotSelector,
  GripDetectionPanel,
  OrientationControls,
  PositionControls,
  CreatureSizeControls,
  ExportOptionsPanel
} from '../components/Equipment'

export const EquipmentPage: React.FC = () => {
  const { assets, loading } = useAssets()
  // Selected items
  const [selectedAvatar, setSelectedAvatar] = useState<Asset | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<Asset | null>(null)

  // Equipment fitting states
  const [isDetectingHandle, setIsDetectingHandle] = useState(false)
  const [handleDetectionResult, setHandleDetectionResult] = useState<HandleDetectionResult | null>(null)
  const [equipmentSlot, setEquipmentSlot] = useState('Hand_R')
  const [showSkeleton, setShowSkeleton] = useState(false)

  // Creature sizing
  const [avatarHeight, setAvatarHeight] = useState(1.83) // Default medium creature height
  const [creatureCategory, setCreatureCategory] = useState('medium')
  const [autoScaleWeapon, setAutoScaleWeapon] = useState(true)
  const [weaponScaleOverride, setWeaponScaleOverride] = useState(1.0) // Base scale, auto-scale will adjust based on creature size

  // Manual rotation controls
  const [manualRotation, setManualRotation] = useState({ x: 0, y: 0, z: 0 })

  // Manual position controls  
  const [manualPosition, setManualPosition] = useState({ x: 0, y: 0, z: 0 })

  // Animation controls
  const [currentAnimation, setCurrentAnimation] = useState<'tpose' | 'walking' | 'running'>('tpose')
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false)

  const viewerRef = useRef<EquipmentViewerRef>(null!)
  const handleDetector = useRef<WeaponHandleDetector | null>(null)

  // Initialize handle detector
  useEffect(() => {
    handleDetector.current = new WeaponHandleDetector()

    return () => {
      // Cleanup on unmount
      if (handleDetector.current) {
        handleDetector.current.dispose()
        handleDetector.current = null
      }
    }
  }, [])

  const handleDetectGripPoint = async () => {
    const equipment = selectedEquipment!
    const detector = handleDetector.current!

    setIsDetectingHandle(true)

    const modelUrl = `/api/assets/${equipment.id}/model`
    const result = await detector.detectHandleArea(modelUrl, true) // Always use consensus mode
    setHandleDetectionResult(result)

    // Log the result for analysis
    console.log('Grip detection result:', {
      gripPoint: result.gripPoint,
      confidence: result.confidence,
      bounds: result.redBoxBounds,
      vertexCount: result.vertices?.length || 0
    })

    // With normalized weapons, grip should already be at origin
    if (result.gripPoint.length() > 0.1) {
      console.warn('Weapon may not be normalized - grip not at origin')
    }

    // Show success message
    setTimeout(() => {
      notify.success('Grip point detected! Weapon is normalized with grip at origin.')
    }, 100)

    setIsDetectingHandle(false)
  }

  const handleSaveConfiguration = () => {
    if (!selectedEquipment || !selectedAvatar) return

    const config = {
      equipmentId: selectedEquipment.id,
      avatarId: selectedAvatar.id,
      slot: equipmentSlot,
      attachmentBone: equipmentSlot,
      avatarHeight,
      autoScale: autoScaleWeapon,
      scaleOverride: weaponScaleOverride,
      handleDetectionResult
    }

    // TODO: Save to equipment metadata
    console.log('Saving attachment configuration:', config)
  }

  const handleExportAlignedModel = async () => {
    const equipment = selectedEquipment!
    const viewer = viewerRef.current!

    const alignedModel = await viewer.exportAlignedEquipment()

    // Create download link
    const blob = new Blob([alignedModel], { type: 'model/gltf-binary' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${equipment.name}-aligned.glb`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportEquippedAvatar = async () => {
    const avatar = selectedAvatar!
    const viewer = viewerRef.current!

    const equippedModel = await viewer.exportEquippedModel()

    // Create download link
    const blob = new Blob([equippedModel], { type: 'model/gltf-binary' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${avatar.name}-equipped.glb`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setAvatarHeight(1.83)
    setCreatureCategory('medium')
    setWeaponScaleOverride(1.0)
  }

  // Reset manual adjustments when equipment changes
  useEffect(() => {
    setManualPosition({ x: 0, y: 0, z: 0 })
    setManualRotation({ x: 0, y: 0, z: 0 })
  }, [selectedEquipment])

  return (
    <div className="flex h-[calc(100vh-60px)] bg-gradient-to-br from-bg-primary to-bg-secondary p-4 gap-4">
      {/* Left Panel - Asset Selection */}
      <AssetSelectionPanel
        assets={assets}
        loading={loading}
        selectedAvatar={selectedAvatar}
        selectedEquipment={selectedEquipment}
        onSelectAvatar={setSelectedAvatar}
        onSelectEquipment={setSelectedEquipment}
      />

      {/* Center - 3D Viewport */}
      <ViewportSection
        selectedAvatar={selectedAvatar}
        selectedEquipment={selectedEquipment}
        equipmentSlot={equipmentSlot}
        showSkeleton={showSkeleton}
        setShowSkeleton={setShowSkeleton}
        viewerRef={viewerRef}
        handleDetectionResult={handleDetectionResult}
        avatarHeight={avatarHeight}
        autoScaleWeapon={autoScaleWeapon}
        weaponScaleOverride={weaponScaleOverride}
        manualRotation={manualRotation}
        manualPosition={manualPosition}
        currentAnimation={currentAnimation}
        setCurrentAnimation={setCurrentAnimation}
        isAnimationPlaying={isAnimationPlaying}
        setIsAnimationPlaying={setIsAnimationPlaying}
      />

      {/* Right Panel - Controls */}
      <div className="card overflow-hidden w-96 flex flex-col bg-gradient-to-br from-bg-primary to-bg-secondary">
        {/* Header */}
        <div className="p-4 border-b border-border-primary bg-bg-primary bg-opacity-30">
          <h2 className="text-lg font-semibold text-text-primary">Fitting Controls</h2>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">

            {/* Equipment Slot Selection */}
            <EquipmentSlotSelector
              equipmentSlot={equipmentSlot}
              onSlotChange={setEquipmentSlot}
            />

            {/* AI Handle Detection */}
            <GripDetectionPanel
              selectedEquipment={selectedEquipment}
              isDetectingHandle={isDetectingHandle}
              handleDetectionResult={handleDetectionResult}
              onDetectGripPoint={handleDetectGripPoint}
            />

            {/* Fine-tune Controls */}
            <OrientationControls
              manualRotation={manualRotation}
              onRotationChange={setManualRotation}
              selectedEquipment={selectedEquipment}
            />

            <PositionControls
              manualPosition={manualPosition}
              onPositionChange={setManualPosition}
              selectedEquipment={selectedEquipment}
            />

            {/* Creature Size Controls */}
            <CreatureSizeControls
              avatarHeight={avatarHeight}
              setAvatarHeight={setAvatarHeight}
              creatureCategory={creatureCategory}
              setCreatureCategory={setCreatureCategory}
              autoScaleWeapon={autoScaleWeapon}
              setAutoScaleWeapon={setAutoScaleWeapon}
              weaponScaleOverride={weaponScaleOverride}
              setWeaponScaleOverride={setWeaponScaleOverride}
              selectedEquipment={selectedEquipment}
              onReset={handleReset}
            />

            {/* Actions */}
            <ExportOptionsPanel
              selectedAvatar={selectedAvatar}
              selectedEquipment={selectedEquipment}
              onSaveConfiguration={handleSaveConfiguration}
              onExportAlignedModel={handleExportAlignedModel}
              onExportEquippedAvatar={handleExportEquippedAvatar}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default EquipmentPage 