import { useEffect } from 'react'

import { useGenerationStore } from '../store'
import { GeneratedAsset, AssetType, BaseAssetMetadata, GenerationAssetMetadata } from '../types'
import { pipelinePollingService } from '../services/PipelinePollingService'
import type { PipelineResult } from '../services/api/GenerationAPIClient'

import { createLogger } from '@/utils/logger'

const logger = createLogger('usePipelineStatus')

interface UsePipelineStatusOptions {
  onComplete?: (asset: GeneratedAsset) => void
}

export function usePipelineStatus({ onComplete }: UsePipelineStatusOptions) {
  // Selective subscriptions for performance
  const currentPipelineId = useGenerationStore(state => state.currentPipelineId)
  const useGPT4Enhancement = useGenerationStore(state => state.useGPT4Enhancement)
  const enableRetexturing = useGenerationStore(state => state.enableRetexturing)
  const enableSprites = useGenerationStore(state => state.enableSprites)
  const assetName = useGenerationStore(state => state.assetName)
  const assetType = useGenerationStore(state => state.assetType)
  const generationType = useGenerationStore(state => state.generationType)
  const characterHeight = useGenerationStore(state => state.characterHeight)
  const generatedAssets = useGenerationStore(state => state.generatedAssets)
  const setIsGenerating = useGenerationStore(state => state.setIsGenerating)
  const updatePipelineStage = useGenerationStore(state => state.updatePipelineStage)
  const setGeneratedAssets = useGenerationStore(state => state.setGeneratedAssets)
  const setSelectedAsset = useGenerationStore(state => state.setSelectedAsset)
  const setActiveView = useGenerationStore(state => state.setActiveView)

  useEffect(() => {
    const DEBUG = (import.meta as any).env?.VITE_DEBUG_PIPELINE === 'true'
    if (DEBUG) logger.debug('Pipeline status effect triggered', { currentPipelineId })
    if (!currentPipelineId) return

    const stageMapping: Record<string, string> = {
      'textInput': 'text-input',
      'promptOptimization': 'gpt4-enhancement',
      'imageGeneration': 'image-generation',
      'image3D': 'image-to-3d',
      'baseModel': 'image-to-3d',
      'textureGeneration': 'retexturing',
      'spriteGeneration': 'sprites',
      'rigging': 'rigging'
    }

    const handleStatusUpdate = (status: PipelineResult) => {
      if (DEBUG) logger.debug('Received status update', { pipelineId: status.id, status: status.status })

      // Update pipeline stages
      Object.entries(status.stages || {}).forEach(([stageName, stageData]) => {
        if (DEBUG) logger.debug('Processing stage', { stageName, stageData })
        const uiStageId = stageMapping[stageName]
        if (uiStageId) {
          let uiStatus = stageData.status === 'processing' ? 'active' : stageData.status

          // Check configuration overrides
          if (uiStageId === 'gpt4-enhancement' && !useGPT4Enhancement) uiStatus = 'skipped'
          if (uiStageId === 'retexturing' && !enableRetexturing) uiStatus = 'skipped'
          if (uiStageId === 'sprites' && !enableSprites) uiStatus = 'skipped'

          // Use updatePipelineStage to update individual stage
          updatePipelineStage(uiStageId, uiStatus)
        }
      })
    }

    const handleComplete = (status: PipelineResult) => {
      setIsGenerating(false)
      const results = status.results
      const config = status.config
      const baseAssetId = config.assetId || assetName.toLowerCase().replace(/\s+/g, '-')

      if (DEBUG) {
        logger.debug('Pipeline completed', { results, rigging: results.rigging })
      }

      const finalAsset: GeneratedAsset = {
        id: baseAssetId,
        name: config.name || assetName,
        description: config.description || `${config.type || assetType} asset`,
        type: config.type || assetType,
        pipelineId: currentPipelineId,
        status: 'completed',
        modelUrl: (results.image3D?.localPath || results.rigging?.localPath) ? `/api/assets/${baseAssetId}/model` : undefined,
        conceptArtUrl: `/api/assets/${baseAssetId}/concept-art.png`,
        variants: results.textureGeneration?.variants || [],
        hasSpriteMetadata: results.spriteGeneration?.status === 'metadata_created' ||
          Boolean(config.enableSprites && results.image3D?.localPath),
        hasSprites: false,
        sprites: null,
        hasModel: !!(results.image3D?.localPath || results.rigging?.localPath),
        modelFile: results.rigging?.localPath || results.image3D?.localPath,
        createdAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
        metadata: {
          id: baseAssetId,
          gameId: baseAssetId,
          name: config.name,
          description: config.description,
          type: config.type as AssetType,
          subtype: config.subtype || '',
          isBaseModel: true,
          meshyTaskId: '', // Not available from pipeline results
          generationMethod: 'gpt-image-meshy' as const,
          variants: [],
          variantCount: 0,
          modelPath: results.rigging?.localPath || results.image3D?.localPath || '',
          hasModel: !!(results.image3D?.localPath || results.rigging?.localPath),
          hasConceptArt: true,
          workflow: 'ai-generation',
          gddCompliant: true,
          isPlaceholder: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          // Extended properties
          isRigged: !!results.rigging && !!results.rigging?.localPath,
          animations: results.rigging?.localPath ? {} : undefined,
          riggedModelPath: results.rigging?.localPath,
          characterHeight: generationType === 'avatar' ? characterHeight : undefined
        } as BaseAssetMetadata & GenerationAssetMetadata
      }

      // Only add if not already exists
      const exists = generatedAssets.some(asset => asset.id === baseAssetId)
      if (!exists) {
        setGeneratedAssets([...generatedAssets, finalAsset])
      }
      setSelectedAsset(finalAsset)
      setActiveView('results')

      // Call onComplete callback if provided
      if (onComplete) {
        onComplete(finalAsset)
      }
    }

    const handleError = (error: string) => {
      logger.error('Pipeline failed', { pipelineId: currentPipelineId, error })
      setIsGenerating(false)
    }

    // Subscribe to pipeline status updates via centralized service
    const unsubscribe = pipelinePollingService.subscribe(currentPipelineId, {
      onStatusUpdate: handleStatusUpdate,
      onComplete: handleComplete,
      onError: handleError
    })

    logger.info('Subscribed to pipeline', {
      pipelineId: currentPipelineId,
      subscriberCount: pipelinePollingService.getSubscriberCount(currentPipelineId)
    })

    return () => {
      unsubscribe()
      logger.info('Unsubscribed from pipeline', {
        pipelineId: currentPipelineId,
        subscriberCount: pipelinePollingService.getSubscriberCount(currentPipelineId)
      })
    }
  }, [
    currentPipelineId,
    useGPT4Enhancement,
    enableRetexturing,
    enableSprites,
    assetName,
    assetType,
    generationType,
    characterHeight,
    generatedAssets,
    setIsGenerating,
    updatePipelineStage,
    setGeneratedAssets,
    setSelectedAsset,
    setActiveView,
    onComplete
  ])

  return {}
} 