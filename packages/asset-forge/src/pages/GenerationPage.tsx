import {
  Sparkles,
  Box, Grid3x3,
  FileText, Brain, Camera, Layers,
  Loader2, User
} from 'lucide-react'
import React, { useState, useEffect, useMemo } from 'react'


import { useGenerationStore } from '../store'
import type { PipelineStage } from '../store'
import { MaterialPreset } from '../types'
import { buildGenerationConfig } from '../utils/generationConfigBuilder'
import { notify } from '../utils/notify'
import { spriteGeneratorClient } from '../utils/sprite-generator-client'

// Import all Generation components from single location
import {
  AssetDetailsCard,
  PipelineOptionsCard,
  AdvancedPromptsCard,
  MaterialVariantsCard,
  AvatarRiggingOptionsCard,
  GenerationTypeSelector,
  TabNavigation,
  GeneratedAssetsList,
  AssetPreviewCard,
  MaterialVariantsDisplay,
  SpritesDisplay,
  PipelineProgressCard,
  EditMaterialPresetModal,
  DeleteConfirmationModal,
  GenerationTimeline,
  AssetActionsCard,
  NoAssetSelected,
  ReferenceImageCard
} from '@/components/Generation'
import {
  Button, Card, CardContent
} from '@/components/common'
import { useGameStylePrompts, useAssetTypePrompts, useMaterialPromptTemplates } from '@/hooks'
import { usePipelineStatus } from '@/hooks'
import { useMaterialPresets } from '@/hooks'
import { Asset, AssetService } from '@/services/api/AssetService'
import { GenerationAPIClient } from '@/services/api/GenerationAPIClient'

interface GenerationPageProps {
  onClose?: () => void
  onNavigateToAssets?: () => void
  onNavigateToAsset?: (assetId: string) => void
}

export const GenerationPage: React.FC<GenerationPageProps> = ({ onClose: _onClose }) => {
  const [apiClient] = useState(() => new GenerationAPIClient())

  // Get all state and actions from the store
  const {
    // UI State
    generationType,
    activeView,
    showAdvancedPrompts,
    showAssetTypeEditor,
    editMaterialPrompts,
    showDeleteConfirm,

    // Material State
    materialPresets,
    isLoadingMaterials,
    editingPreset,

    // Form State
    assetName,
    assetType,
    description,
    gameStyle,
    customStyle,

    // Custom Prompts
    customGamePrompt,
    customAssetTypePrompt,

    // Asset Type Management
    customAssetTypes,
    assetTypePrompts,

    // Pipeline Configuration
    useGPT4Enhancement,
    enableRetexturing,
    enableSprites,
    quality,

    // Avatar Configuration
    enableRigging,
    characterHeight,
    
    // Reference image state
    referenceImageMode,
    referenceImageSource,
    referenceImageUrl,
    referenceImageDataUrl,

    // Material Configuration
    selectedMaterials,
    customMaterials,
    materialPromptOverrides,

    // Pipeline State
    isGenerating,
    isGeneratingSprites,
    pipelineStages,

    // Results State
    generatedAssets,
    selectedAsset,

    // Actions
    setGenerationType,
    setActiveView,
    setShowAdvancedPrompts,
    setShowAssetTypeEditor,
    setEditMaterialPrompts,
    setShowDeleteConfirm,
    setMaterialPresets,
    setIsLoadingMaterials,
    setEditingPreset,
    setAssetName,
    setAssetType,
    setDescription,
    setGameStyle,
    setCustomStyle,
    setCustomGamePrompt,
    setCustomAssetTypePrompt,
    setCustomAssetTypes,
    setAssetTypePrompts,
    addCustomAssetType,
    setUseGPT4Enhancement,
    setEnableRetexturing,
    setEnableSprites,
    setQuality,
    setEnableRigging,
    setCharacterHeight,
    setReferenceImageMode,
    setReferenceImageSource,
    setReferenceImageUrl,
    setReferenceImageDataUrl,
    setSelectedMaterials,
    setCustomMaterials,
    setMaterialPromptOverrides,
    addCustomMaterial,
    toggleMaterialSelection,
    setIsGenerating,
    setCurrentPipelineId,
    setIsGeneratingSprites,
    setModelLoadError,
    setIsModelLoading,
    setPipelineStages,
    setGeneratedAssets,
    setSelectedAsset,
    resetForm,
    resetPipeline,
    initializePipelineStages
  } = useGenerationStore()

  // Load prompts
  const { prompts: gameStylePrompts, loading: gameStyleLoading, saveCustomGameStyle, deleteCustomGameStyle } = useGameStylePrompts()
  const { 
    prompts: loadedAssetTypePrompts, 
    loading: _assetTypeLoading, 
    saveCustomAssetType,
    deleteCustomAssetType,
    // getAllTypes,
    getTypesByGeneration 
  } = useAssetTypePrompts()
  const { templates: materialPromptTemplates } = useMaterialPromptTemplates()
  
  // Get custom game styles
  const customGameStyles = useMemo(() => {
    if (!gameStylePrompts) return {}
    return gameStylePrompts.custom || {}
  }, [gameStylePrompts])
  
  // Get asset types for the current generation type
  const currentGenerationTypes = useMemo(() => {
    if (!loadedAssetTypePrompts || !generationType) return {}
    return getTypesByGeneration(generationType)
  }, [loadedAssetTypePrompts, generationType, getTypesByGeneration])
  
  // Convert current generation types to the format expected by AdvancedPromptsCard
  const currentTypePrompts = useMemo(() => {
    return Object.entries(currentGenerationTypes).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: value.prompt || ''
    }), {})
  }, [currentGenerationTypes])
  
  // Get current style prompt
  const currentStylePrompt = useMemo(() => {
    if (!gameStylePrompts) return ''
    if (gameStyle === 'runescape') {
      return gameStylePrompts.default?.runescape?.base || ''
    } else if (gameStyle === 'custom' && customStyle && gameStylePrompts.custom?.[customStyle]) {
      return gameStylePrompts.custom[customStyle].base || ''
    }
    return gameStylePrompts.default?.generic?.base || ''
  }, [gameStyle, customStyle, gameStylePrompts])
  
  // Get all saved custom types for the current generation type
  const allCustomAssetTypes = useMemo(() => {
    if (!generationType) return []
    
    // Define default types for each generation type
    const defaultTypes = generationType === 'avatar' 
      ? ['character', 'humanoid', 'npc', 'creature']
      : ['weapon', 'armor', 'tool', 'building', 'consumable', 'resource']
    
    // Get saved custom types for current generation type
    const savedCustomTypes = Object.entries(currentGenerationTypes)
      .filter(([key]) => !defaultTypes.includes(key))
      .map(([key, value]) => ({
        name: value.name || key,
        prompt: value.prompt || ''
      }))
    
    // Add temporary custom types that aren't saved yet
    const tempTypes = customAssetTypes.filter(t => 
      t.name && !savedCustomTypes.some(saved => saved.name.toLowerCase() === t.name.toLowerCase())
    )
    
    return [...savedCustomTypes, ...tempTypes]
  }, [currentGenerationTypes, customAssetTypes, generationType])

  // Load prompts on mount and update store
  useEffect(() => {
    if (!gameStyleLoading && gameStylePrompts) {
      // Set default game prompt from loaded prompts if not already set
      const defaultPrompt = gameStylePrompts.default?.generic?.base || 'low-poly 3D game asset style'
      if (!customGamePrompt) {
        setCustomGamePrompt(defaultPrompt)
      }
    }
  }, [gameStyleLoading, gameStylePrompts, customGamePrompt, setCustomGamePrompt])
  
  // Apply game style specific prompts when game style changes
  useEffect(() => {
    if (!gameStyleLoading && gameStylePrompts && gameStyle) {
      if (gameStyle === 'runescape') {
        const runescapePrompt = gameStylePrompts.default?.runescape?.base
        if (runescapePrompt) {
          setCustomGamePrompt(runescapePrompt)
        }
      } else if (gameStyle === 'custom' && customStyle && gameStylePrompts.custom?.[customStyle]) {
        const customStylePrompt = gameStylePrompts.custom[customStyle].base
        if (customStylePrompt) {
          setCustomGamePrompt(customStylePrompt)
        }
      }
    }
  }, [gameStyle, customStyle, gameStyleLoading, gameStylePrompts, setCustomGamePrompt])

  // Set asset type based on generation type
  useEffect(() => {
    if (generationType === 'avatar') {
      setAssetType('character')
    } else if (generationType === 'item') {
      setAssetType('weapon')
    }
  }, [generationType, setAssetType])

  // Update pipeline stages based on configuration and generation type
  useEffect(() => {
    // Initialize pipeline stages
    initializePipelineStages()
  }, [generationType, useGPT4Enhancement, enableRetexturing, enableSprites, enableRigging, initializePipelineStages])

  // Add icons to stages after they're initialized (without creating an update loop)
  useEffect(() => {
    if (pipelineStages.length === 0) return

    // Only set icons if any stage is missing one
    const missingIcons = pipelineStages.some(stage => !stage.icon)
    if (!missingIcons) return

    const iconFor = (id: string) => (
      id === 'text-input' ? <FileText className="w-4 h-4" /> :
      id === 'gpt4-enhancement' ? <Brain className="w-4 h-4" /> :
      id === 'image-generation' ? <Camera className="w-4 h-4" /> :
      id === 'image-to-3d' ? <Box className="w-4 h-4" /> :
      id === 'rigging' ? <User className="w-4 h-4" /> :
      id === 'retexturing' ? <Layers className="w-4 h-4" /> :
      id === 'sprites' ? <Grid3x3 className="w-4 h-4" /> :
      <Sparkles className="w-4 h-4" />
    )

    const stagesWithIcons = pipelineStages.map(stage => ({
      ...stage,
      icon: stage.icon ?? iconFor(stage.id)
    }))

    setPipelineStages(stagesWithIcons)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineStages.length])

  // Handle model loading state when selected asset changes
  useEffect(() => {
    if (selectedAsset?.modelUrl || selectedAsset?.hasModel) {
      setIsModelLoading(false)  // Don't show loading state, let ThreeViewer handle it
      setModelLoadError(null)
    }
  }, [selectedAsset, setIsModelLoading, setModelLoadError])

  // Load material presets from API (run once), and default selections once
  useEffect(() => {
    let didCancel = false
    const loadMaterialPresets = async () => {
      try {
        setIsLoadingMaterials(true)
        const data = await AssetService.getMaterialPresets()
        if (!Array.isArray(data)) {
          throw new Error('Material presets data is not an array')
        }
        if (didCancel) return
        setMaterialPresets(data)

        // Set defaults only if nothing selected yet
        if (selectedMaterials.length === 0) {
          const defaults = ['bronze', 'steel', 'mithril']
          const available = defaults.filter(id => data.some((p: MaterialPreset) => p.id === id))
          setSelectedMaterials(available)
        }
      } catch (error) {
        console.error('[MaterialPresets] Failed to load material presets:', error)
      } finally {
        if (!didCancel) setIsLoadingMaterials(false)
      }
    }
    loadMaterialPresets()
    return () => { didCancel = true }
  // Intentionally run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load existing assets when Results tab is accessed
  useEffect(() => {
    if (activeView === 'results' && generatedAssets.length === 0) {
      const loadExistingAssets = async () => {
        try {
          const assets = await AssetService.listAssets()

          // Transform API assets to match the expected format
          const transformedAssets = assets.map((asset: Asset) => ({
            id: asset.id,
            name: asset.name,
            description: asset.description,
            type: asset.type,
            status: 'completed',
            hasModel: asset.hasModel,
            modelUrl: asset.hasModel ? `/api/assets/${asset.id}/model` : undefined,
            conceptArtUrl: `/api/assets/${asset.id}/concept-art.png`,
            variants: Array.isArray((asset as any).metadata?.variants)
              ? ((asset.metadata as any).variants as { name: string; modelUrl: string }[])
              : undefined,
            metadata: asset.metadata || {},
            createdAt: (asset.generatedAt || asset.metadata?.generatedAt || new Date().toISOString()),
            generatedAt: (asset.generatedAt || asset.metadata?.generatedAt || new Date().toISOString())
          }))

          setGeneratedAssets(transformedAssets)

          // Select the first asset if none selected
          if (transformedAssets.length > 0 && !selectedAsset) {
            setSelectedAsset(transformedAssets[0])
          }
        } catch (error) {
          console.error('Failed to load existing assets:', error)
        }
      }

      loadExistingAssets()
    }
  }, [activeView, generatedAssets, selectedAsset, setGeneratedAssets, setSelectedAsset])

  // Use the pipeline status hook
  usePipelineStatus({ apiClient })

  // Use the material presets hook
  const { handleSaveCustomMaterials, handleUpdatePreset, handleDeletePreset } = useMaterialPresets()

  // Handle saving custom asset types
  const handleSaveCustomAssetTypes = async () => {
    if (!generationType) {
      notify.warning('Please select a generation type first')
      return
    }
    
    try {
      // Save each custom asset type
      const savePromises = customAssetTypes
        .filter(customType => customType.name && customType.prompt)
        .map(customType => {
          const typeId = customType.name.toLowerCase().replace(/\s+/g, '-')
          return saveCustomAssetType(typeId, {
            name: customType.name,
            prompt: customType.prompt,
            placeholder: customType.prompt
          }, generationType)
        })
      
      // Wait for all saves to complete
      await Promise.all(savePromises)
      
      // Clear only the temporary custom types after successful save
      setCustomAssetTypes([])
      
      // The saved types will automatically appear via allCustomAssetTypes
      notify.success('Custom asset types saved successfully!')
    } catch (error) {
      console.error('Failed to save custom asset types:', error)
      notify.error('Failed to save custom asset types.')
    }
  }

  const handleGenerateSprites = async (assetId: string) => {
    try {
      setIsGeneratingSprites(true)

      const sprites = await spriteGeneratorClient.generateSpritesForAsset(assetId, {
        angles: 8,
        resolution: 256,
        backgroundColor: 'transparent'
      })

      // Update the generated assets with the new sprite URLs
      const updatedAssets = generatedAssets.map(asset =>
        asset.id === assetId
          ? { ...asset, sprites, hasSprites: true }
          : asset
      )
      setGeneratedAssets(updatedAssets)

      if (selectedAsset?.id === assetId) {
        setSelectedAsset({ ...selectedAsset, sprites, hasSprites: true })
      }

    } catch (error) {
      console.error('Failed to generate sprites:', error)
      notify.error('Failed to generate sprites. Please check the console for details.')
    } finally {
      setIsGeneratingSprites(false)
    }
  }

  const handleStartGeneration = async () => {
    if (!assetName || !description) {
      notify.warning('Please fill in all required fields')
      return
    }

    setIsGenerating(true)
    setActiveView('progress')
    const updatedPipelineStages = pipelineStages.map(stage => ({
      ...stage,
      status: (stage.id === 'text-input' ? 'active' :
        stage.id === 'gpt4-enhancement' && !useGPT4Enhancement ? 'skipped' :
          stage.id === 'retexturing' && !enableRetexturing ? 'skipped' :
            stage.id === 'sprites' && !enableSprites ? 'skipped' :
              'idle') as PipelineStage['status']
    }))
    setPipelineStages(updatedPipelineStages)

    // Get the appropriate asset type prompt
    const currentAssetTypePrompt = customAssetTypePrompt ||
      assetTypePrompts[assetType] ||
      customAssetTypes.find(t => t.name.toLowerCase() === assetType)?.prompt ||
      ''

    // Get the game style configuration
    const gameStyleConfig = gameStyle === 'runescape' 
      ? gameStylePrompts?.default?.runescape
      : gameStyle === 'custom' && customStyle 
        ? gameStylePrompts?.custom?.[customStyle] || gameStylePrompts?.default?.generic
        : gameStylePrompts?.default?.generic

    const config = buildGenerationConfig({
      assetName,
      assetType,
      description,
      generationType,
      gameStyle,
      customStyle,
      customGamePrompt: customGamePrompt || gameStyleConfig?.base,
      customAssetTypePrompt: currentAssetTypePrompt,
      useGPT4Enhancement,
      enableRetexturing,
      enableSprites,
      enableRigging,
      characterHeight,
      selectedMaterials,
      materialPresets,
      materialPromptOverrides,
      materialPromptTemplates: materialPromptTemplates.templates,
      gameStyleConfig,
      quality
    })

    // Attach reference image into config when selected
    console.log('[Frontend Debug] Reference image state:', {
      mode: referenceImageMode,
      source: referenceImageSource,
      hasUrl: !!referenceImageUrl,
      hasDataUrl: !!referenceImageDataUrl,
      urlLength: referenceImageUrl?.length,
      dataUrlLength: referenceImageDataUrl?.length
    })

    if (referenceImageMode === 'custom') {
      const imgUrl = (referenceImageSource === 'url' && referenceImageUrl) ? referenceImageUrl : null
      const dataUrl = (referenceImageSource === 'upload' && referenceImageDataUrl) ? referenceImageDataUrl : null
      if (imgUrl || dataUrl) {
        ;(config as any).referenceImage = {
          source: dataUrl ? 'data' : 'url',
          url: imgUrl || undefined,
          dataUrl: dataUrl || undefined
        }
        console.log('[Frontend Debug] Attached reference image to config:', (config as any).referenceImage)
      }
    }

    console.log('Starting generation with config:', config)
    console.log('Material variants to generate:', config.materialPresets)

    try {
      const pipelineId = await apiClient.startPipeline(config)
      setCurrentPipelineId(pipelineId)
    } catch (error) {
      console.error('Failed to start generation:', error)
      setIsGenerating(false)
      notify.error('Failed to start generation. Please check the console.')
    }
  }

  React.useEffect(() => {
    // Enable smooth scrolling on the body with hidden scrollbar
    const ensureScrollable = () => {
      document.body.style.overflow = 'auto'
      document.documentElement.style.overflow = 'auto'
      document.body.classList.add('hide-scrollbar')
      document.documentElement.classList.add('hide-scrollbar')
    }

    // Initial setup
    ensureScrollable()

    // Re-apply on any click to ensure scrolling isn't lost
    const handleClick = () => {
      // Small delay to ensure any other handlers have run first
      setTimeout(ensureScrollable, 0)
    }

    document.addEventListener('click', handleClick)

    return () => {
      document.removeEventListener('click', handleClick)
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.body.classList.remove('hide-scrollbar')
      document.documentElement.classList.remove('hide-scrollbar')
    }
  }, [])

  // Show generation type selector first
  if (!generationType) {
    return (
      <div className="fixed inset-0 overflow-hidden">
        <GenerationTypeSelector onSelectType={setGenerationType} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 pt-[60px] bg-bg-primary bg-opacity-95 backdrop-blur-xl z-40 overflow-y-auto animate-fade-in scrollbar-hide">
      {/* Main container with hidden scrollbar for clean appearance while maintaining scroll functionality */}
      
      {/* Main Content Area */}
      <div className="bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
          {/* Header with tabs */}
          <div className="mb-6">
            {/* Tab Navigation */}
            <TabNavigation
              activeView={activeView}
              generatedAssetsCount={generatedAssets.length}
              onTabChange={setActiveView}
            />
          </div>
          {/* Configuration Form View */}
          {activeView === 'config' && (
            <div className="animate-fade-in space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Asset Details Card */}
                  <AssetDetailsCard
                    generationType={generationType}
                    assetName={assetName}
                    assetType={assetType}
                    description={description}
                    gameStyle={gameStyle}
                    customStyle={customStyle}
                    customAssetTypes={allCustomAssetTypes}
                    customGameStyles={customGameStyles}
                    onAssetNameChange={setAssetName}
                    onAssetTypeChange={setAssetType}
                    onDescriptionChange={setDescription}
                    onGameStyleChange={setGameStyle}
                    onCustomStyleChange={setCustomStyle}
                    onBack={() => {
                      setGenerationType(undefined)
                      setActiveView('config')
                      resetForm()
                      resetPipeline()
                    }}
                    onSaveCustomGameStyle={saveCustomGameStyle}
                  />

                  {/* Advanced Prompts Card */}
                  <AdvancedPromptsCard
                    showAdvancedPrompts={showAdvancedPrompts}
                    showAssetTypeEditor={showAssetTypeEditor}
                    generationType={generationType}
                    gameStyle={gameStyle}
                    customStyle={customStyle}
                    customGamePrompt={customGamePrompt}
                    customAssetTypePrompt={customAssetTypePrompt}
                    assetTypePrompts={currentTypePrompts}
                    customAssetTypes={customAssetTypes}
                    currentStylePrompt={currentStylePrompt}
                    gameStylePrompts={gameStylePrompts}
                    loadedPrompts={{
                      avatar: loadedAssetTypePrompts?.avatar?.default?.character?.placeholder,
                      item: loadedAssetTypePrompts?.item?.default?.weapon?.placeholder
                    }}
                    onToggleAdvancedPrompts={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
                    onToggleAssetTypeEditor={() => setShowAssetTypeEditor(!showAssetTypeEditor)}
                    onCustomGamePromptChange={setCustomGamePrompt}
                    onCustomAssetTypePromptChange={setCustomAssetTypePrompt}
                    onAssetTypePromptsChange={(updatedPrompts) => {
                      // Merge the updated prompts with the existing store prompts
                      setAssetTypePrompts({
                        ...assetTypePrompts,
                        ...updatedPrompts
                      })
                    }}
                    onCustomAssetTypesChange={setCustomAssetTypes}
                    onAddCustomAssetType={addCustomAssetType}
                    onSaveCustomAssetTypes={handleSaveCustomAssetTypes}
                    onSaveCustomGameStyle={saveCustomGameStyle}
                    onDeleteCustomGameStyle={deleteCustomGameStyle}
                    onDeleteCustomAssetType={deleteCustomAssetType}
                  />
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                  {/* Pipeline Options */}
                  <PipelineOptionsCard
                    generationType={generationType}
                    useGPT4Enhancement={useGPT4Enhancement}
                    enableRetexturing={enableRetexturing}
                    enableSprites={enableSprites}
                    enableRigging={enableRigging}
                    quality={quality}
                    onUseGPT4EnhancementChange={setUseGPT4Enhancement}
                    onEnableRetexturingChange={setEnableRetexturing}
                    onEnableSpritesChange={setEnableSprites}
                    onEnableRiggingChange={setEnableRigging}
                    onQualityChange={setQuality}
                  />

                  {/* Material Variants */}
                  {enableRetexturing && generationType === 'item' && (
                    <MaterialVariantsCard
                      gameStyle={gameStyle}
                      isLoadingMaterials={isLoadingMaterials}
                      materialPresets={materialPresets}
                      selectedMaterials={selectedMaterials}
                      customMaterials={customMaterials}
                      materialPromptOverrides={materialPromptOverrides}
                      editMaterialPrompts={editMaterialPrompts}
                      onToggleMaterialSelection={toggleMaterialSelection}
                      onEditMaterialPromptsToggle={() => setEditMaterialPrompts(!editMaterialPrompts)}
                      onMaterialPromptOverride={(materialId, prompt) => {
                        setMaterialPromptOverrides({
                          ...materialPromptOverrides,
                          [materialId]: prompt
                        })
                      }}
                      onAddCustomMaterial={addCustomMaterial}
                      onUpdateCustomMaterial={(index, material) => {
                        const updated = [...customMaterials]
                        updated[index] = material
                        setCustomMaterials(updated)
                      }}
                      onRemoveCustomMaterial={(index) => {
                        setCustomMaterials(customMaterials.filter((_, i) => i !== index))
                      }}
                      onSaveCustomMaterials={handleSaveCustomMaterials}
                      onEditPreset={setEditingPreset}
                      onDeletePreset={setShowDeleteConfirm}
                    />
                  )}

                  {/* Avatar Rigging Options */}
                  {generationType === 'avatar' && enableRigging && (
                    <AvatarRiggingOptionsCard
                      characterHeight={characterHeight}
                      onCharacterHeightChange={setCharacterHeight}
                    />
                  )}

                  {/* Reference Image Selection */}
                  <ReferenceImageCard
                    generationType={generationType}
                    mode={referenceImageMode}
                    source={referenceImageSource}
                    url={referenceImageUrl}
                    dataUrl={referenceImageDataUrl}
                    onModeChange={setReferenceImageMode}
                    onSourceChange={setReferenceImageSource}
                    onUrlChange={setReferenceImageUrl}
                    onDataUrlChange={setReferenceImageDataUrl}
                  />

                  {/* Start Generation Button */}
                  <Card className="overflow-hidden bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-primary/20">
                    <CardContent className="p-4">
                      <Button
                        onClick={handleStartGeneration}
                        disabled={!assetName || !description || isGenerating}
                        className="w-full h-14 text-base font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-[1.01]"
                        size="lg"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5 mr-2 animate-pulse" />
                            Start Generation
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Progress View */}
          {activeView === 'progress' && (
            <div className="animate-fade-in space-y-8">
              <PipelineProgressCard
                pipelineStages={pipelineStages}
                generationType={generationType}
                isGenerating={isGenerating}
                onBackToConfig={() => setActiveView('config')}
                onBack={() => {
                  setGenerationType(undefined)
                  setActiveView('config')
                  resetForm()
                  resetPipeline()
                }}
              />

              {/* Additional Progress Info */}
              <GenerationTimeline />
            </div>
          )}

          {/* Results View */}
          {activeView === 'results' && (
            <div className="animate-fade-in space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Asset List */}
                <GeneratedAssetsList
                  generatedAssets={generatedAssets}
                  selectedAsset={selectedAsset}
                  onAssetSelect={setSelectedAsset}
                  onBack={() => {
                    setGenerationType(undefined)
                    setActiveView('config')
                    resetForm()
                    resetPipeline()
                  }}
                />

                {/* Asset Details */}
                <div className="lg:col-span-3 space-y-8">
                  {selectedAsset ? (
                    <>
                      {/* 3D Preview */}
                      <AssetPreviewCard
                        selectedAsset={selectedAsset}
                        generationType={generationType}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Material Variants */}
                        {generationType === 'item' && selectedAsset.variants && (
                          <MaterialVariantsDisplay variants={selectedAsset.variants} />
                        )}

                        {/* 2D Sprites */}
                        {generationType === 'item' && (
                          <SpritesDisplay
                            selectedAsset={selectedAsset}
                            isGeneratingSprites={isGeneratingSprites}
                            onGenerateSprites={handleGenerateSprites}
                          />
                        )}
                      </div>

                      {/* Actions */}
                      <AssetActionsCard
                        onGenerateNew={() => {
                          setActiveView('config')
                          setAssetName('')
                          setDescription('')
                        }}
                      />
                    </>
                  ) : (
                    <NoAssetSelected />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Material Preset Modal */}
      {editingPreset && (
        <EditMaterialPresetModal
          editingPreset={editingPreset}
          onClose={() => setEditingPreset(null)}
          onSave={handleUpdatePreset}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmationModal
          showDeleteConfirm={showDeleteConfirm}
          materialPresets={materialPresets}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDeletePreset}
        />
      )}
    </div>
  )
}

export default GenerationPage 