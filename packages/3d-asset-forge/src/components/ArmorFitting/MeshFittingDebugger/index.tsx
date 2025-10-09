import React, { useRef, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { MeshFittingService } from '../../../services/fitting/MeshFittingService'
import { ArmorFittingService } from '../../../services/fitting/ArmorFittingService'
import { cn } from '../../../styles'
import { X, Play, Grid3x3, Link, Activity, RotateCcw, Pause, Box, Sliders, Download, Wrench, ChevronDown, Settings, FileDown } from 'lucide-react'
import { useDebuggerStore } from '../../../store/useDebuggerStore'
import { useAssets } from '../../../hooks/useAssets'
import { ExtendedMesh } from '../../../types'
import { Checkbox } from '../../common'

// Import types
import { MeshFittingDebuggerProps } from './types'

// Import components
import { Scene, RangeInput } from './components'

// Import hooks
import { useExportHandlers } from './hooks/useExportHandlers'
import { useFittingHandlers } from './hooks/useFittingHandlers'

// Import utils
import { selectClassName } from './utils'

export function MeshFittingDebugger({ onClose }: MeshFittingDebuggerProps) {
    // Get assets from the API
    const { assets, loading } = useAssets()

    // Transform assets into the format expected by the component
    const availableAvatars = React.useMemo(() => {
        return assets
            .filter(asset => asset.type === 'character' && asset.hasModel)
            .map(asset => ({
                id: asset.id,
                name: asset.name,
                path: `/api/assets/${asset.id}/model`
            }))
    }, [assets])

    const availableArmors = React.useMemo(() => {
        return assets
            .filter(asset =>
                asset.hasModel && (
                    asset.type === 'armor' ||
                    (asset.name.toLowerCase().includes('body') && !asset.name.toLowerCase().includes('helmet'))
                )
            )
            .map(asset => ({
                id: asset.id,
                name: asset.name,
                path: `/api/assets/${asset.id}/model`
            }))
    }, [assets])

    const availableHelmets = React.useMemo(() => {
        return assets
            .filter(asset =>
                asset.hasModel && (
                    asset.name.toLowerCase().includes('helmet') ||
                    asset.name.toLowerCase().includes('head')
                )
            )
            .map(asset => ({
                id: asset.id,
                name: asset.name,
                path: `/api/assets/${asset.id}/model`
            }))
    }, [assets])

    // Preload models when assets are loaded
    React.useEffect(() => {
        availableAvatars.forEach(avatar => {
            if (avatar.path) useGLTF.preload(avatar.path)
        })
        availableArmors.forEach(armor => {
            if (armor.path) useGLTF.preload(armor.path)
        })
        availableHelmets.forEach(helmet => {
            if (helmet.path) useGLTF.preload(helmet.path)
        })
    }, [availableAvatars, availableArmors, availableHelmets])

    // Get state and actions from Zustand store
    const {
        // State
        activeDemo,
        viewMode,
        showWireframe,
        selectedAvatar,
        selectedArmor,
        selectedHelmet,
        selectedAvatarPath,
        selectedArmorPath,
        selectedHelmetPath,
        currentAnimation,
        isAnimationPlaying,
        fittingParameters,
        helmetFittingMethod,
        helmetSizeMultiplier,
        helmetFitTightness,
        helmetVerticalOffset,
        helmetForwardOffset,
        helmetRotation,
        showHeadBounds,
        showCollisionDebug,
        showHull,
        showDebugArrows,
        debugArrowDensity,
        debugColorMode,
        isProcessing,
        isArmorFitted,
        isArmorBound,
        isHelmetFitted,
        isHelmetAttached,
        boundArmorMesh,
        lastError,

        // Actions
        setActiveDemo,
        setViewMode,
        toggleWireframe,
        setShowWireframe,
        setSelectedAvatar,
        setSelectedArmor,
        setSelectedHelmet,
        setCurrentAnimation,
        setIsAnimationPlaying,
        toggleAnimation,
        updateFittingParameters,
        resetFittingParameters,
        setHelmetFittingMethod,
        setHelmetSizeMultiplier,
        setHelmetFitTightness,
        setHelmetVerticalOffset,
        setHelmetForwardOffset,
        setHelmetRotation,
        resetHelmetSettings,
        setShowHeadBounds,
        setShowCollisionDebug,
        setShowHull,
        setShowDebugArrows,
        setDebugArrowDensity,
        setDebugColorMode,
        toggleDebugVisualization,
        setIsProcessing,
        setIsArmorFitted,
        setIsArmorBound,
        setIsHelmetFitted,
        setIsHelmetAttached,
        setBoundArmorMesh,
        resetProcessingStates,
        setError,
        clearError,
        resetDebugger,
        saveDebugConfiguration,
        loadDebugConfiguration,
        isReadyToFit,
        getActiveModelName,
        getCurrentDebugInfo
    } = useDebuggerStore()

    // Refs (keep these as they're for Three.js objects)
    const fittingService = useRef(new MeshFittingService())
    const armorFittingService = useRef(new ArmorFittingService())
    const sceneRef = useRef<THREE.Scene | null>(null)
    const avatarMeshRef = useRef<THREE.SkinnedMesh | null>(null)
    const armorMeshRef = useRef<ExtendedMesh | null>(null)
    const helmetMeshRef = useRef<ExtendedMesh | null>(null)
    const originalArmorGeometryRef = useRef<THREE.BufferGeometry | null>(null)
    const originalHelmetTransformRef = useRef<{
        position: THREE.Vector3,
        rotation: THREE.Euler,
        scale: THREE.Vector3
    } | null>(null)
    const debugArrowGroupRef = useRef<THREE.Group | null>(null)
    const headBoundsHelperRef = useRef<THREE.Box3Helper | null>(null)
    const hullMeshRef = useRef<THREE.Mesh | null>(null)

    // Temporary state for skinned armor mesh (keep as local state for now)
    const [skinnedArmorMesh, setSkinnedArmorMesh] = useState<THREE.SkinnedMesh | null>(null)
    const [showExportDropdown, setShowExportDropdown] = useState(false)
    const [showDebugOptions, setShowDebugOptions] = useState(false)

    // Add click outside handler for dropdowns
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            // Check if click is outside both dropdowns
            if (!target.closest('.export-dropdown-container') && 
                !target.closest('.debug-dropdown-container')) {
                setShowExportDropdown(false)
                setShowDebugOptions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // Don't handle shortcuts when typing in inputs
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return
            }

            switch (e.key.toLowerCase()) {
                case 'w':
                    toggleWireframe()
                    break
                case 'p':
                    if (viewMode === 'sphereCube' && !isProcessing) {
                        performFitting('cubeToSphere')
                    } else if (viewMode === 'avatarArmor' && !isProcessing) {
                        performFitting('avatarToArmor')
                    }
                    break
                case 'r':
                    resetMeshes()
                    break
                case ' ':
                    e.preventDefault()
                    toggleAnimation()
                    break
                case 'escape':
                    onClose()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyPress)
        return () => window.removeEventListener('keydown', handleKeyPress)
    }, [viewMode, isProcessing, toggleWireframe, toggleAnimation, onClose])

    // Get export handlers
    const { handleExportBoundArmor } = useExportHandlers({
        boundArmorMesh,
        selectedArmor,
        setIsProcessing,
        setError,
        setShowExportDropdown
    })

    // Get fitting handlers
    const {
        performFitting,
        bindArmorToSkeleton,
        performHelmetFitting,
        attachHelmetToHead,
        detachHelmetFromHead,
        resetMeshes
    } = useFittingHandlers({
        // Refs
        sceneRef,
        avatarMeshRef,
        armorMeshRef,
        helmetMeshRef,
        originalArmorGeometryRef,
        originalHelmetTransformRef,
        debugArrowGroupRef,
        headBoundsHelperRef,
        hullMeshRef,
        fittingService,
        armorFittingService,
        
        // State setters
        setIsProcessing,
        setIsArmorFitted,
        setIsArmorBound,
        setIsHelmetFitted,
        setIsHelmetAttached,
        setBoundArmorMesh,
        setSkinnedArmorMesh,
        setError,
        resetProcessingStates,
        
        // State values
        isProcessing,
        showHull,
        fittingParameters,
        selectedAvatar,
        showDebugArrows: fittingParameters.showDebugArrows || false,
        helmetFittingMethod,
        helmetSizeMultiplier,
        helmetFitTightness,
        helmetVerticalOffset,
        helmetForwardOffset,
        helmetRotation,
        viewMode
    })

    // Comprehensive reset function that resets everything
    const handleFullReset = () => {
        console.log('=== PERFORMING FULL RESET ===')
        
        // Reset meshes and scene
        resetMeshes()
        
        // Reset animation states
        setCurrentAnimation('tpose')
        setIsAnimationPlaying(false)
        
        // Reset visual states (except showHeadBounds which should maintain user preference)
        setShowWireframe(false)
        setShowHull(false)
        // Keep showHeadBounds as-is - don't reset it
        setShowCollisionDebug(false)
        
        // Reset fitting parameters to defaults
        resetFittingParameters()
        
        // Reset helmet settings to defaults
        resetHelmetSettings()
        
        // Reset all processing states
        resetProcessingStates()
        
        // Clear any errors
        setError('')
        
        // Force a re-render by toggling a dummy state
        setShowDebugOptions(prev => {
            const newValue = !prev
            // Immediately set it back to maintain the current state
            setTimeout(() => setShowDebugOptions(prev), 0)
            return newValue
        })
        
        console.log('=== FULL RESET COMPLETE ===')
    }

    // Handle view mode changes with cleanup
    const handleViewModeChange = (newMode: 'sphereCube' | 'avatarArmor' | 'helmetFitting') => {
        console.log(`=== CHANGING VIEW MODE: ${viewMode} -> ${newMode} ===`)
        
        // Don't do anything if we're already in this mode
        if (viewMode === newMode) return
        
        // Clean up meshes from the scene based on what we're leaving
        if (sceneRef.current) {
            const scene = sceneRef.current
            const objectsToRemove: THREE.Object3D[] = []
            
            // Traverse scene and collect objects to remove
            scene.traverse((obj) => {
                // If leaving helmet fitting mode, remove ALL helmet-related objects
                if (viewMode === 'helmetFitting' && newMode !== 'helmetFitting') {
                    if (obj.userData?.isHelmet || obj.name === 'HelmetClone' || 
                        (obj.userData?.hasBeenFitted && obj !== armorMeshRef.current)) {
                        objectsToRemove.push(obj)
                    }
                }
                
                // If leaving armor fitting mode, remove ALL armor-related objects
                if (viewMode === 'avatarArmor' && newMode !== 'avatarArmor') {
                    if (obj.userData?.isArmor || obj.name === 'ArmorClone' || 
                        (obj.userData?.hasBeenFitted && obj !== helmetMeshRef.current)) {
                        objectsToRemove.push(obj)
                    }
                }
                
                // Always remove debug objects when switching modes
                if (obj.userData?.isDebug || obj.name === 'debugArrows') {
                    objectsToRemove.push(obj)
                }
            })
            
            // Remove collected objects
            const uniqueObjects = Array.from(new Set(objectsToRemove))
            uniqueObjects.forEach(obj => {
                console.log('Removing object:', obj.name || 'unnamed', obj.type)
                if (obj.parent) {
                    obj.parent.remove(obj)
                }
                
                // Dispose of geometry and materials
                obj.traverse((child) => {
                    if ('geometry' in child && child.geometry) {
                        (child.geometry as THREE.BufferGeometry).dispose()
                    }
                    if ('material' in child && child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material]
                        materials.forEach((m: THREE.Material) => m.dispose())
                    }
                })
            })
            
            // Clear debug arrows
            if (fittingService.current) {
                fittingService.current.clearDebugArrows()
            }
            
            // Clear specific refs based on mode change
            if (viewMode === 'helmetFitting' && newMode !== 'helmetFitting') {
                // Clear helmet-specific state when leaving helmet mode
                setIsHelmetFitted(false)
                setIsHelmetAttached(false)
            }
            
            if (viewMode === 'avatarArmor' && newMode !== 'avatarArmor') {
                // Clear armor-specific state when leaving armor mode
                setIsArmorFitted(false)
                setIsArmorBound(false)
                setBoundArmorMesh(null)
                setSkinnedArmorMesh(null)
            }
        }
        
        // Now change the mode
        setViewMode(newMode)
    }

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm pt-16">
            <div className="relative w-[90vw] h-[85vh] max-w-[1600px] bg-bg-primary rounded-2xl shadow-2xl flex overflow-hidden">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 h-16 bg-bg-secondary/80 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-6 z-20">
                    <h2 className="text-xl font-semibold text-text-primary">Mesh Fitting Debugger</h2>
                    
                    {/* View Mode Selection - Centered */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
                        <button
                            onClick={() => handleViewModeChange('sphereCube')}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                                viewMode === 'sphereCube'
                                    ? "bg-primary text-white"
                                    : "bg-bg-tertiary text-text-secondary hover:bg-white/10"
                            )}
                        >
                            Basic Demo
                        </button>
                        <button
                            onClick={() => handleViewModeChange('avatarArmor')}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                                viewMode === 'avatarArmor'
                                    ? "bg-primary text-white"
                                    : "bg-bg-tertiary text-text-secondary hover:bg-white/10"
                            )}
                        >
                            Avatar/Armor
                        </button>
                        <button
                            onClick={() => handleViewModeChange('helmetFitting')}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                                viewMode === 'helmetFitting'
                                    ? "bg-primary text-white"
                                    : "bg-bg-tertiary text-text-secondary hover:bg-white/10"
                            )}
                        >
                            Helmet Fitting
                        </button>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
                    >
                        <X className="w-5 h-5 text-text-secondary" />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex mt-16">
                    {/* Left Panel - Asset Selection & Controls */}
                    <div className="w-80 bg-bg-secondary/50 backdrop-blur-sm border-r border-white/10 p-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-6">
                            {/* Model Selection - Only show for avatar/armor and helmet modes */}
                            {(viewMode === 'avatarArmor' || viewMode === 'helmetFitting') && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-blue-500/20 rounded-lg">
                                            <Box className="w-5 h-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-semibold text-text-primary">Model Selection</h3>
                                            <p className="text-xs text-text-secondary mt-0.5">{viewMode === 'avatarArmor' ? 'Choose avatar and armor' : 'Choose avatar and helmet'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                    
                                    {/* Avatar Selection */}
                                    <div>
                                        <label className="block text-xs text-text-tertiary mb-2">Avatar</label>
                                        <select
                                            value={selectedAvatar?.id || ''}
                                            onChange={(e) => {
                                                const avatar = availableAvatars.find(a => a.id === e.target.value)
                                                if (avatar) {
                                                    setSelectedAvatar({
                                                        id: avatar.id,
                                                        name: avatar.name,
                                                        path: avatar.path
                                                    })
                                                    resetProcessingStates()
                                                }
                                            }}
                                            className={selectClassName}
                                        >
                                            <option value="">Select Avatar...</option>
                                            {availableAvatars.map(avatar => (
                                                <option key={avatar.id} value={avatar.id}>
                                                    {avatar.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-text-tertiary mt-1">{selectedAvatar?.name || 'No avatar selected'} character model</p>
                                    </div>

                                    {/* Armor/Helmet Selection based on mode */}
                                    {viewMode === 'avatarArmor' ? (
                                        <div>
                                            <label className="block text-xs text-text-tertiary mb-2">Armor</label>
                                            <select
                                                value={selectedArmor?.id || ''}
                                                onChange={(e) => {
                                                    const armor = availableArmors.find(a => a.id === e.target.value)
                                                    if (armor) {
                                                        setSelectedArmor({
                                                            id: armor.id,
                                                            name: armor.name,
                                                            path: armor.path
                                                        })
                                                        resetProcessingStates()
                                                    }
                                                }}
                                                className={selectClassName}
                                            >
                                                <option value="">Select Armor...</option>
                                                {availableArmors.map(armor => (
                                                    <option key={armor.id} value={armor.id}>
                                                        {armor.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-text-tertiary mt-1">{selectedArmor?.name || 'No armor selected'} armor variant</p>
                                        </div>
                                    ) : viewMode === 'helmetFitting' ? (
                                        <div>
                                            <label className="block text-xs text-text-tertiary mb-2">Helmet</label>
                                            <select
                                                value={selectedHelmet?.id || ''}
                                                onChange={(e) => {
                                                    const helmet = availableHelmets.find(h => h.id === e.target.value)
                                                    if (helmet) {
                                                        setSelectedHelmet({
                                                            id: helmet.id,
                                                            name: helmet.name,
                                                            path: helmet.path
                                                        })
                                                        resetProcessingStates()
                                                    }
                                                }}
                                                className={selectClassName}
                                            >
                                                <option value="">Select Helmet...</option>
                                                {availableHelmets.map(helmet => (
                                                    <option key={helmet.id} value={helmet.id}>
                                                        {helmet.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-text-tertiary mt-1">{selectedHelmet?.name || 'No helmet selected'}</p>
                                        </div>
                                    ) : null}
                                    </div>
                                </div>
                            )}

                            {/* Animation Controls */}
                            {(viewMode === 'avatarArmor' || viewMode === 'helmetFitting') && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-medium text-text-secondary">Animation</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => setCurrentAnimation('tpose')}
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
                                            onClick={() => setCurrentAnimation('walking')}
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
                                            onClick={() => setCurrentAnimation('running')}
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
                                    <button
                                        onClick={toggleAnimation}
                                        disabled={currentAnimation === 'tpose'}
                                        className={cn(
                                            "w-full px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2",
                                            currentAnimation === 'tpose'
                                                ? "bg-bg-tertiary text-text-tertiary cursor-not-allowed"
                                                : isAnimationPlaying
                                                    ? "bg-orange-600 text-white hover:bg-orange-700"
                                                    : "bg-green-600 text-white hover:bg-green-700"
                                        )}
                                    >
                                        {isAnimationPlaying ? (
                                            <>
                                                <Pause className="w-4 h-4" />
                                                <span>Pause Animation</span>
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-4 h-4" />
                                                <span>Play Animation</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Display Options */}
                            {viewMode === 'avatarArmor' && (
                                <div className="space-y-3 mb-6">
                                    <h3 className="text-sm font-medium text-text-secondary">Display Options</h3>
                                    <div className="space-y-2">
                                        <Checkbox
                                            checked={showWireframe}
                                            onChange={(e) => setShowWireframe(e.target.checked)}
                                            label="Armor Wireframe"
                                            description="Toggle wireframe display for armor mesh"
                                            size="sm"
                                        />
                                        <Checkbox
                                            checked={showHull}
                                            onChange={(e) => setShowHull(e.target.checked)}
                                            label="Show Body Hull"
                                            description="Display the extracted body hull during armor fitting"
                                            size="sm"
                                        />
                                    </div>
                                </div>
                            )}
                            
                            {/* Display Options for Basic Demo */}
                            {viewMode === 'sphereCube' && (
                                <div className="space-y-3 mb-6">
                                    <h3 className="text-sm font-medium text-text-secondary">Display Options</h3>
                                    <div className="space-y-2">
                                        <Checkbox
                                            checked={showWireframe}
                                            onChange={(e) => setShowWireframe(e.target.checked)}
                                            label="Show Wireframe"
                                            description="Toggle wireframe display for all meshes"
                                            size="sm"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Fitting Parameters - Show for all modes */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-primary/20 rounded-lg">
                                        <Sliders className="w-5 h-5 text-primary" />
                                    </div>
                                    <div className="flex-1 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-semibold text-text-primary">Fitting Parameters</h3>
                                            <p className="text-xs text-text-secondary mt-0.5">Adjust algorithm behavior</p>
                                        </div>
                                        <button
                                            onClick={resetFittingParameters}
                                            className="text-xs text-primary hover:text-primary-light transition-colors"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Iterations</label>
                                                <span className="text-xs text-text-secondary">{fittingParameters.iterations}</span>
                                            </div>
                                            <RangeInput
                                                min={1}
                                                max={20}
                                                step={1}
                                                value={fittingParameters.iterations}
                                                onChange={(e) => updateFittingParameters({ iterations: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Step Size</label>
                                                <span className="text-xs text-text-secondary">{fittingParameters.stepSize?.toFixed(2) || 0.1}</span>
                                            </div>
                                            <RangeInput
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                value={fittingParameters.stepSize || 0.1}
                                                onChange={(e) => updateFittingParameters({ stepSize: parseFloat(e.target.value) })}
                                            />
                                            <p className="text-xs text-text-tertiary mt-1">Movement per iteration</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Smoothing Radius</label>
                                                <span className="text-xs text-text-secondary">{fittingParameters.smoothingRadius?.toFixed(1) || 2}</span>
                                            </div>
                                            <RangeInput
                                                min={0}
                                                max={5}
                                                step={0.5}
                                                value={fittingParameters.smoothingRadius || 2}
                                                onChange={(e) => updateFittingParameters({ smoothingRadius: parseFloat(e.target.value) })}
                                            />
                                            <p className="text-xs text-text-tertiary mt-1">Neighbor influence radius</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Smoothing Strength</label>
                                                <span className="text-xs text-text-secondary">{fittingParameters.smoothingStrength.toFixed(2)}</span>
                                            </div>
                                            <RangeInput
                                                min={0}
                                                max={1}
                                                step={0.05}
                                                value={fittingParameters.smoothingStrength}
                                                onChange={(e) => updateFittingParameters({ smoothingStrength: parseFloat(e.target.value) })}
                                            />
                                            <p className="text-xs text-text-tertiary mt-1">Influence on neighbors</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Target Offset</label>
                                                <span className="text-xs text-text-secondary">{(fittingParameters.targetOffset * 100).toFixed(1)}cm</span>
                                            </div>
                                            <RangeInput
                                                min={0}
                                                max={0.1}
                                                step={0.005}
                                                value={fittingParameters.targetOffset}
                                                onChange={(e) => updateFittingParameters({ targetOffset: parseFloat(e.target.value) })}
                                            />
                                            <p className="text-xs text-text-tertiary mt-1">Distance from surface</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Sample Rate</label>
                                                <span className="text-xs text-text-secondary">{((fittingParameters.sampleRate || 0.5) * 100).toFixed(0)}%</span>
                                            </div>
                                            <RangeInput
                                                min={0.1}
                                                max={1.0}
                                                step={0.1}
                                                value={fittingParameters.sampleRate || 0.5}
                                                onChange={(e) => updateFittingParameters({ sampleRate: parseFloat(e.target.value) })}
                                            />
                                            <p className="text-xs text-text-tertiary mt-1">Vertices processed per iteration</p>
                                        </div>
                                        <div className="pt-2 space-y-2">
                                            <Checkbox
                                                checked={fittingParameters.preserveFeatures || false}
                                                onChange={(e) => updateFittingParameters({ preserveFeatures: e.target.checked })}
                                                label="Preserve Features"
                                                description="Preserve sharp edges and flat surfaces during smoothing"
                                                size="sm"
                                            />
                                            <Checkbox
                                                checked={fittingParameters.useImprovedShrinkwrap || false}
                                                onChange={(e) => updateFittingParameters({ useImprovedShrinkwrap: e.target.checked })}
                                                label="Improved Shrinkwrap"
                                                description="Use improved shrinkwrap algorithm with surface relaxation"
                                                size="sm"
                                            />
                                            {viewMode === 'avatarArmor' && (
                                                <>
                                                    <Checkbox
                                                        checked={fittingParameters.preserveOpenings || false}
                                                        onChange={(e) => updateFittingParameters({ preserveOpenings: e.target.checked })}
                                                        label="Preserve Openings"
                                                        description="Lock vertices around neck and arm regions to preserve armor openings"
                                                        size="sm"
                                                    />
                                                    <Checkbox
                                                        checked={fittingParameters.pushInteriorVertices || false}
                                                        onChange={(e) => updateFittingParameters({ pushInteriorVertices: e.target.checked })}
                                                        label="Push Interior Vertices"
                                                        description="Restore vertices that end up inside the avatar back to their pre-shrinkwrap positions"
                                                        size="sm"
                                                    />
                                                </>
                                            )}
                                        </div>
                                        
                                        {/* Debug Visualization Subsection - Only for avatarArmor mode */}
                                        {viewMode === 'avatarArmor' && (
                                            <div className="space-y-2 border-t border-white/10 pt-4 mt-4">
                                                <h4 className="text-sm font-semibold text-primary">Debug Visualization</h4>
                                            
                                            <Checkbox
                                                checked={fittingParameters.showDebugArrows || false}
                                                onChange={(e) => updateFittingParameters({ showDebugArrows: e.target.checked })}
                                                label="Show Debug Arrows"
                                                description="Display arrows showing vertex movement direction and magnitude"
                                                size="sm"
                                            />
                                            {fittingParameters.showDebugArrows && (
                                                <div className="ml-6 space-y-2">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <label className="text-xs text-text-tertiary">Arrow Density</label>
                                                            <span className="text-xs text-text-secondary">1/{fittingParameters.debugArrowDensity || 10}</span>
                                                        </div>
                                                        <RangeInput
                                                            min={1}
                                                            max={20}
                                                            step={1}
                                                            value={fittingParameters.debugArrowDensity || 10}
                                                            onChange={(e) => updateFittingParameters({ debugArrowDensity: parseInt(e.target.value) })}
                                                        />
                                                        <p className="text-xs text-text-tertiary">Show every Nth vertex (lower = more arrows)</p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-text-tertiary mb-1">Color Mode</label>
                                                        <select
                                                            value={fittingParameters.debugColorMode || 'direction'}
                                                            onChange={(e) => updateFittingParameters({ debugColorMode: e.target.value as 'direction' | 'magnitude' | 'sidedness' })}
                                                            className={cn(selectClassName, "text-xs")}
                                                            disabled={!fittingParameters.showDebugArrows}
                                                        >
                                                            <option value="direction">Movement Direction</option>
                                                            <option value="magnitude">Movement Magnitude</option>
                                                            <option value="sidedness">Vertex Sidedness</option>
                                                        </select>
                                                        <p className="text-xs text-text-tertiary">How to color-code the debug visualization</p>
                                                    </div>
                                                    
                                                    {/* Color Legend */}
                                                    <div className="mt-3 p-2 bg-bg-secondary/50 rounded">
                                                        <p className="text-xs font-medium text-text-secondary mb-1">Color Legend</p>
                                                        {(fittingParameters.debugColorMode || 'direction') === 'direction' ? (
                                                            <div className="space-y-1 text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Forward (bad for back vertices)</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Backward (good for back vertices)</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Up/Down</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Sideways</span>
                                                                </div>
                                                            </div>
                                                        ) : (fittingParameters.debugColorMode || 'direction') === 'magnitude' ? (
                                                            <div className="space-y-1 text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Small movement</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Medium movement</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Large movement</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1 text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Front vertices</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Back vertices</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                                                                    <span className="text-text-tertiary">Side vertices</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        )}
                                    </div>
                                </div>

                            {/* Helmet Parameters */}
                            {viewMode === 'helmetFitting' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-text-secondary">Helmet Parameters</h3>
                                        <button
                                            onClick={resetHelmetSettings}
                                            className="text-xs text-primary hover:text-primary-light transition-colors"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                    
                                    {/* Fitting Method */}
                                    <div>
                                        <label className="block text-xs text-text-tertiary mb-2">Fitting Method</label>
                                        <select
                                            value={helmetFittingMethod}
                                            onChange={(e) => setHelmetFittingMethod(e.target.value as 'auto' | 'manual')}
                                            className={selectClassName}
                                        >
                                            <option value="auto">Automatic</option>
                                            <option value="manual">Manual</option>
                                        </select>
                                        <p className="text-xs text-text-tertiary mt-1">
                                            {helmetFittingMethod === 'auto' ? 'AI-powered placement' : 'Manual adjustment'}
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {/* Size */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Size</label>
                                                <span className="text-xs text-text-secondary">{(helmetSizeMultiplier * 100).toFixed(0)}%</span>
                                            </div>
                                            <RangeInput
                                                min={0.8}
                                                max={1.2}
                                                step={0.01}
                                                value={helmetSizeMultiplier}
                                                onChange={(e) => setHelmetSizeMultiplier(parseFloat(e.target.value))}
                                            />
                                        </div>
                                        
                                        {/* Fit Tightness */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Fit Tightness</label>
                                                <span className="text-xs text-text-secondary">{(helmetFitTightness * 100).toFixed(0)}%</span>
                                            </div>
                                            <RangeInput
                                                min={0.7}
                                                max={1.0}
                                                step={0.01}
                                                value={helmetFitTightness}
                                                onChange={(e) => setHelmetFitTightness(parseFloat(e.target.value))}
                                            />
                                            <p className="text-xs text-text-tertiary mt-1">How snug the helmet fits (lower = tighter)</p>
                                        </div>
                                        
                                        {/* Vertical Offset */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Vertical Offset</label>
                                                <span className="text-xs text-text-secondary">{helmetVerticalOffset.toFixed(2)}</span>
                                            </div>
                                            <RangeInput
                                                min={-0.1}
                                                max={0.1}
                                                step={0.005}
                                                value={helmetVerticalOffset}
                                                onChange={(e) => setHelmetVerticalOffset(parseFloat(e.target.value))}
                                            />
                                        </div>
                                        
                                        {/* Forward Offset */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs text-text-tertiary">Forward Offset</label>
                                                <span className="text-xs text-text-secondary">{helmetForwardOffset.toFixed(2)}</span>
                                            </div>
                                            <RangeInput
                                                min={-0.05}
                                                max={0.05}
                                                step={0.005}
                                                value={helmetForwardOffset}
                                                onChange={(e) => setHelmetForwardOffset(parseFloat(e.target.value))}
                                            />
                                        </div>
                                        
                                        <div className="pt-2 space-y-2 border-t border-white/10 mt-4">
                                            <Checkbox
                                                checked={showWireframe}
                                                onChange={(e) => setShowWireframe(e.target.checked)}
                                                label="Show Wireframe"
                                                description="Toggle wireframe display for helmet mesh"
                                                size="sm"
                                            />
                                            <Checkbox
                                                checked={showHeadBounds}
                                                onChange={(e) => setShowHeadBounds(e.target.checked)}
                                                label="Show Head Bounds"
                                                description="Display bounding box around the head bone"
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center - 3D View */}
                    <div className="flex-1 relative bg-bg-primary">
                        <div className="absolute inset-0">
                            <Canvas
                                camera={{ position: [5, 5, 5], fov: 50 }}
                                onCreated={({ scene }) => { sceneRef.current = scene }}
                            >
                                <Scene
                                    fittingService={fittingService}
                                    isProcessing={isProcessing}
                                    showWireframe={showWireframe}
                                    viewMode={viewMode}
                                    selectedAvatarPath={selectedAvatar?.path || selectedAvatarPath}
                                    selectedArmorPath={selectedArmor?.path || selectedArmorPath}
                                    selectedHelmetPath={selectedHelmet?.path || selectedHelmetPath}
                                    avatarMeshRef={avatarMeshRef}
                                    armorMeshRef={armorMeshRef}
                                    helmetMeshRef={helmetMeshRef}
                                    originalArmorGeometryRef={originalArmorGeometryRef}
                                    originalHelmetTransformRef={originalHelmetTransformRef}
                                    debugArrowGroupRef={debugArrowGroupRef}
                                    headBoundsHelperRef={headBoundsHelperRef}
                                    currentAnimation={currentAnimation}
                                    isAnimationPlaying={isAnimationPlaying}
                                    showHeadBounds={showHeadBounds}
                                    boundArmorMesh={boundArmorMesh}
                                />
                            </Canvas>
                        </div>

                        {/* Wireframe Indicator */}
                        {showWireframe && (
                            <div className="absolute top-4 left-4 bg-bg-primary/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 flex items-center gap-2">
                                <Grid3x3 className="w-4 h-4 text-primary" />
                                <span className="text-xs text-text-secondary">Wireframe</span>
                            </div>
                        )}

                        {/* Animation Controls removed - now in sidebar */}

                        {/* Control Buttons */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3 z-10 max-w-[90%]">
                            {viewMode === 'sphereCube' ? (
                                <>
                                    <button
                                        onClick={() => performFitting('cubeToSphere')}
                                        disabled={isProcessing}
                                        className={cn(
                                            "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                                            "bg-primary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                                            isProcessing && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <Play className="w-4 h-4" />
                                        <span>Fit Cube to Sphere</span>
                                    </button>
                                    <button
                                        onClick={() => performFitting('sphereToCube')}
                                        disabled={isProcessing}
                                        className={cn(
                                            "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                                            "bg-secondary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                                            isProcessing && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <Play className="w-4 h-4" />
                                        <span>Fit Sphere to Cube</span>
                                    </button>
                                </>
                            ) : viewMode === 'avatarArmor' ? (
                                <>
                                    {!isArmorFitted ? (
                                        <button
                                            onClick={() => performFitting('avatarToArmor')}
                                            disabled={isProcessing || !selectedAvatar || !selectedArmor}
                                            className={cn(
                                                "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                                                "bg-primary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                                                (isProcessing || !selectedAvatar || !selectedArmor) && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <Play className="w-4 h-4" />
                                            <span>Fit Armor to Avatar</span>
                                        </button>
                                    ) : (
                                        <>
                                            {!isArmorBound ? (
                                                <>
                                                    <button
                                                        onClick={bindArmorToSkeleton}
                                                        disabled={isProcessing}
                                                        className={cn(
                                                            "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                                                            "bg-green-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                                                            isProcessing && "opacity-50 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <Link className="w-4 h-4" />
                                                        <span>Bind Armor to Skeleton</span>
                                                    </button>
                                                    <button
                                                        onClick={handleFullReset}
                                                        className={cn(
                                                            "px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2",
                                                            "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-white/10"
                                                        )}
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                        <span>Reset</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Export Options */}
                                                    <div className="relative export-dropdown-container">
                                                        <button
                                                            onClick={() => setShowExportDropdown(!showExportDropdown)}
                                                            className={cn(
                                                                "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                                                                "bg-blue-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                                                            )}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                            <span>Export Options</span>
                                                            <ChevronDown className={cn(
                                                                "w-4 h-4 transition-transform duration-200",
                                                                showExportDropdown && "rotate-180"
                                                            )} />
                                                        </button>

                                                        {showExportDropdown && (
                                                            <div className="absolute bottom-full mb-2 left-0 right-0 min-w-[250px] bg-bg-primary rounded-lg shadow-xl border border-white/10 overflow-hidden">
                                                                <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                                                    <button
                                                                        onClick={() => handleExportBoundArmor('full')}
                                                                        className="w-full px-3 py-2 text-left rounded-md hover:bg-bg-secondary transition-colors duration-150 flex items-center gap-2 text-sm"
                                                                    >
                                                                        <FileDown className="w-4 h-4 text-primary" />
                                                                        <div>
                                                                            <div className="font-medium text-text-primary">Export (Full Skeleton)</div>
                                                                            <div className="text-xs text-text-secondary">Complete skeleton with all bones</div>
                                                                        </div>
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleExportBoundArmor('minimal')}
                                                                        className="w-full px-3 py-2 text-left rounded-md hover:bg-bg-secondary transition-colors duration-150 flex items-center gap-2 text-sm"
                                                                    >
                                                                        <Download className="w-4 h-4 text-green-400" />
                                                                        <div>
                                                                            <div className="font-medium text-text-primary">Export (Minimal)</div>
                                                                            <div className="text-xs text-text-secondary">Only required bones</div>
                                                                        </div>
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleExportBoundArmor('static')}
                                                                        className="w-full px-3 py-2 text-left rounded-md hover:bg-bg-secondary transition-colors duration-150 flex items-center gap-2 text-sm"
                                                                    >
                                                                        <Download className="w-4 h-4 text-text-secondary" />
                                                                        <div>
                                                                            <div className="font-medium text-text-primary">Static Export</div>
                                                                            <div className="text-xs text-text-secondary">No skeleton, posed mesh only</div>
                                                                        </div>
                                                                    </button>

                                                                    {showDebugOptions && (
                                                                        <>
                                                                            <div className="h-px bg-white/10 my-2" />

                                                                            <button
                                                                                onClick={() => handleExportBoundArmor('debug')}
                                                                                className="w-full px-3 py-2 text-left rounded-md hover:bg-bg-secondary transition-colors duration-150 flex items-center gap-2 text-sm"
                                                                            >
                                                                                <Wrench className="w-4 h-4 text-orange-400" />
                                                                                <div>
                                                                                    <div className="font-medium text-text-primary">Debug Export</div>
                                                                                    <div className="text-xs text-text-secondary">With bone visualization</div>
                                                                                </div>
                                                                            </button>

                                                                            <button
                                                                                onClick={() => handleExportBoundArmor('scale-fixed')}
                                                                                className="w-full px-3 py-2 text-left rounded-md hover:bg-bg-secondary transition-colors duration-150 flex items-center gap-2 text-sm"
                                                                            >
                                                                                <Wrench className="w-4 h-4 text-red-400" />
                                                                                <div>
                                                                                    <div className="font-medium text-text-primary">Fix Scale & Export</div>
                                                                                    <div className="text-xs text-text-secondary">Apply scale corrections</div>
                                                                                </div>
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Debug Options Toggle */}
                                                    <div className="relative debug-dropdown-container">
                                                        <button
                                                            onClick={() => setShowDebugOptions(!showDebugOptions)}
                                                            className={cn(
                                                                "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2",
                                                                "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary",
                                                                "border border-white/10"
                                                            )}
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                            <span>{showDebugOptions ? 'Hide' : 'Show'} Debug Options</span>
                                                            <ChevronDown className={cn(
                                                                "w-4 h-4 transition-transform duration-200 -rotate-180",
                                                                showDebugOptions && "rotate-0"
                                                            )} />
                                                        </button>

                                                        {showDebugOptions && (
                                                            <div className="absolute bottom-full mb-2 right-0 w-64 bg-bg-primary rounded-lg shadow-xl border border-white/10 overflow-hidden">
                                                                <div className="p-3 space-y-2">
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!boundArmorMesh) return
                                                                            try {
                                                                                const { BoneDiagnostics } = await import('../../../services/fitting/BoneDiagnostics')
                                                                                console.clear()
                                                                                BoneDiagnostics.analyzeSkeletonForExport(boundArmorMesh.skeleton, 'Bound Armor Skeleton')

                                                                                // Test with different scales
                                                                                const testSkeletonM = BoneDiagnostics.createTestSkeleton('meters')
                                                                                const testSkeletonCM = BoneDiagnostics.createTestSkeleton('centimeters')

                                                                                BoneDiagnostics.analyzeSkeletonForExport(testSkeletonM, 'Test Skeleton (Meters)')
                                                                                BoneDiagnostics.analyzeSkeletonForExport(testSkeletonCM, 'Test Skeleton (CM)')

                                                                                BoneDiagnostics.compareSkeletons(
                                                                                    boundArmorMesh.skeleton, 'Armor',
                                                                                    testSkeletonCM, 'Test CM'
                                                                                )

                                                                                console.log('Diagnostics complete - check console')
                                                                            } catch (error) {
                                                                                console.error('Diagnostics failed:', error)
                                                                            }
                                                                        }}
                                                                        disabled={!boundArmorMesh}
                                                                        className={cn(
                                                                            "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2",
                                                                            "bg-gray-600 text-white hover:bg-gray-700",
                                                                            !boundArmorMesh && "opacity-50 cursor-not-allowed"
                                                                        )}
                                                                    >
                                                                        <Activity className="w-4 h-4" />
                                                                        <span>Run Diagnostics</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    )}
                                </>
                            ) : viewMode === 'helmetFitting' ? (
                                <>
                                    <button
                                        onClick={() => performHelmetFitting()}
                                        disabled={isProcessing}
                                        className={cn(
                                            "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                                            "bg-primary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                                            isProcessing && "opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <Play className="w-4 h-4" />
                                        <span>Auto-Fit Helmet</span>
                                    </button>

                                    {isHelmetFitted && (
                                        <>
                                            <button
                                                onClick={() => isHelmetAttached ? detachHelmetFromHead() : attachHelmetToHead()}
                                                disabled={isProcessing || !helmetMeshRef.current}
                                                className={cn(
                                                    "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                                                    isHelmetAttached
                                                        ? "bg-orange-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                                                        : "bg-green-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                                                    (isProcessing || !helmetMeshRef.current) && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                <Link className="w-4 h-4" />
                                                <span>{isHelmetAttached ? 'Detach from Head' : 'Attach to Head'}</span>
                                            </button>

                                            {isHelmetAttached && (
                                                <div className="px-4 py-2 bg-green-600/20 border border-green-600/30 rounded-lg text-green-400 text-sm font-medium flex items-center gap-2">
                                                    <Link className="w-4 h-4" />
                                                    <span>Helmet Attached</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            ) : null}

                            {/* Common Controls */}
                            <button
                                onClick={resetMeshes}
                                disabled={isProcessing}
                                className={cn(
                                    "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                                    "bg-bg-primary/80 backdrop-blur-sm border border-white/10 text-text-primary",
                                    "hover:bg-bg-secondary hover:border-white/20 hover:scale-105",
                                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                )}
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span>Reset</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}